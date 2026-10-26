import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMySessions, requestReturn } from '../api/sessions';
import TypeThumb from '../components/TypeThumb';
import usePolling from '../hooks/usePolling';
import { formatClock } from '../utils/time';
import './ReturnItem.css';

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'DAMAGED', label: 'Damaged' }
];

// The student says "I want to return this". The late clock stops right now.
// Staff then checks the item and confirms (that is a separate step on their screen).
function ReturnItem() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [open, setOpen] = useState([]); // the student's unfinished sessions
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(params.get('session') || '');
  const [condition, setCondition] = useState('GOOD');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  const knownPending = useRef(new Set()); // returns we saw waiting for staff

  const load = useCallback(async () => {
    try {
      const res = await getMySessions({ open: 'true' });
      const sessions = res.data.data;

      // A return that was waiting and is no longer listed has been confirmed by staff
      const nowPending = new Set(sessions.filter((s) => s.status === 'RETURN_PENDING').map((s) => s._id));
      const confirmed = [...knownPending.current].filter((id) => !nowPending.has(id));
      if (confirmed.length > 0) {
        setResult({ ok: true, text: 'Staff confirmed your return. Thank you!' });
      }
      knownPending.current = nowPending;

      setOpen(sessions);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 10000); // so "waiting for staff" turns into "confirmed" by itself

  const held = open.filter((s) => s.status === 'ACTIVE');
  const waitingForStaff = open.filter((s) => s.status === 'RETURN_PENDING');
  const hasRequest = open.some((s) => s.status === 'ISSUE_PENDING');
  const selected = held.find((s) => s._id === selectedId) || held[0];

  const damaged = condition === 'DAMAGED';
  const canSend = Boolean(selected) && !submitting && (!damaged || note.trim().length >= 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setSubmitting(true);
    setResult(null);
    try {
      const code = selected.unit?.unitCode || selected.type?.name || 'the item';
      await requestReturn({ sessionId: selected._id, conditionClaimed: condition, note: note.trim() });
      setResult({
        ok: true,
        text: `Return requested for ${code}. Your time has stopped. Show the item to staff at the counter.`
      });
      setNote('');
      setCondition('GOOD');
      setSelectedId('');
      await load();
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || 'Could not request the return. Please try again.' });
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Give it back</p>
        <h1>Return an item</h1>
        <p className="page-sub">Tell us the condition, then show the item to staff. They confirm the return.</p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {result && (
        <p className={`notice ${result.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {result.text}
        </p>
      )}

      {loading ? (
        <p className="rt-empty">Loading...</p>
      ) : (
        <>
          {held.length > 0 ? (
            <form className="card rt-form" onSubmit={handleSubmit}>
              <h2>{held.length > 1 ? 'Which item are you returning?' : 'Item to return'}</h2>

              <div className="rt-picks" role="radiogroup" aria-label="Item to return">
                {held.map((s) => (
                  <label key={s._id} className={s._id === selected._id ? 'rt-pick rt-pick-on' : 'rt-pick'}>
                    <input
                      type="radio"
                      name="session"
                      checked={s._id === selected._id}
                      onChange={() => setSelectedId(s._id)}
                      disabled={held.length === 1}
                    />
                    <TypeThumb type={s.type} size={48} />
                    <span className="rt-pick-text">
                      <strong>{s.type?.name || 'Item'}</strong>
                      <span className="rt-code">{s.unit?.unitCode}</span>
                      <small>
                        Due {formatClock(s.dueAt)}
                        {s.isOverdue ? ' - overdue' : ''}
                      </small>
                    </span>
                  </label>
                ))}
              </div>

              <label className="field">
                <span>Condition of the item</span>
                <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{damaged ? 'What is damaged?' : 'Note for staff (optional)'}</span>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder={damaged ? 'e.g. Handle cracked, net torn on one side' : ''}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required={damaged}
                />
              </label>
              {damaged && note.trim().length < 3 && <p className="rt-hint">Please describe the damage (at least 3 characters).</p>}

              <button type="submit" disabled={!canSend}>
                {submitting ? 'Sending...' : 'Request return'}
              </button>
              <p className="rt-hint">Your time stops when you press this button, even if staff takes a while to check.</p>
            </form>
          ) : (
            waitingForStaff.length === 0 && (
              <div className="card rt-blank">
                <p>You are not holding anything right now.</p>
                <button type="button" onClick={() => navigate('/scan')}>Request an item</button>
              </div>
            )
          )}

          {waitingForStaff.length > 0 && (
            <section aria-labelledby="rt-waiting">
              <h2 id="rt-waiting">Waiting for staff to check</h2>
              <ul className="rt-list">
                {waitingForStaff.map((s) => (
                  <li key={s._id} className="card rt-wait">
                    <TypeThumb type={s.type} size={48} />
                    <div>
                      <strong>{s.type?.name || 'Item'}</strong> <span className="rt-code">{s.unit?.unitCode}</span>
                      <p className="rt-hint">
                        Return requested at {formatClock(s.returnRequestedAt)}. Show it at the staff counter.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasRequest && (
            <p className="rt-hint">
              You also have a request waiting for approval. <button type="button" className="btn-ghost" onClick={() => navigate('/scan')}>View it</button>
            </p>
          )}
        </>
      )}
    </>
  );
}

export default ReturnItem;