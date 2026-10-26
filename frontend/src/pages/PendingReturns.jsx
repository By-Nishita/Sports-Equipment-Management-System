import { useState, useCallback } from 'react';
import { getPendingReturns, confirmReturn, flagMismatch } from '../api/sessions';
import TypeThumb from '../components/TypeThumb';
import usePolling from '../hooks/usePolling';
import { formatTime, formatClock, formatAgo, formatMinutes } from '../utils/time';
import './StaffDesk.css';

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'DAMAGED', label: 'Damaged' }
];
const label = (value) => CONDITIONS.find((c) => c.value === value)?.label || value;

const errorText = (err, fallback) => err.response?.data?.message || fallback;

// One return waiting to be checked. Staff compares the item in hand with the unit ID
// shown in big letters, picks the real condition, then confirms.
function ReturnCard({ session, onResult }) {
  const type = session.type || {};
  const student = session.user || {};
  const unitCode = session.unit?.unitCode || '?';

  const [condition, setCondition] = useState(session.conditionClaimed || 'GOOD');
  const [note, setNote] = useState(session.conditionNote || '');
  const [busy, setBusy] = useState(false);
  const [mismatching, setMismatching] = useState(false);
  const [mismatchNote, setMismatchNote] = useState('');

  const damaged = condition === 'DAMAGED';

  // Minutes between the due time and the moment the student ASKED to return
  const pastDue = session.dueAt && session.returnRequestedAt
    ? Math.floor((new Date(session.returnRequestedAt) - new Date(session.dueAt)) / 60000)
    : 0;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await confirmReturn(session._id, { conditionVerified: condition, note: note.trim() });
      onResult({ ok: true, text: `${unitCode}: ${res.data.message}` });
    } catch (err) {
      onResult({ ok: false, text: errorText(err, 'Could not confirm the return. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const flag = async () => {
    if (busy || mismatchNote.trim().length < 3) return;
    setBusy(true);
    try {
      await flagMismatch(session._id, mismatchNote.trim());
      setMismatching(false);
      setMismatchNote('');
      onResult({ ok: true, text: `Mismatch recorded for ${unitCode}. The return is still open.` });
    } catch (err) {
      onResult({ ok: false, text: errorText(err, 'Could not record the mismatch. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card sd-card">
      <div className="sd-top">
        <TypeThumb type={type} size={64} />
        <div className="sd-title">
          <p className="sd-code" aria-label={`Unit ${unitCode}`}>{unitCode}</p>
          <p className="sd-sub">
            {type.name || 'Item'} - <strong>{student.name || 'Unknown student'}</strong>
            {student.srn ? ` - ${student.srn}` : ''}
            {student.phone ? ` - ${student.phone}` : ''}
          </p>
        </div>
        <span className="sd-when">Asked {formatAgo(session.returnRequestedAt)}</span>
      </div>

      {session.mismatchFlagged && (
        <p className="notice notice-error" role="status">
          A mismatch was flagged: the item brought back may not be {unitCode}.
        </p>
      )}

      <dl className="sd-facts">
        <div>
          <dt>Issued</dt>
          <dd>{formatTime(session.approvedAt)}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{formatClock(session.dueAt)}</dd>
        </div>
        <div>
          <dt>Return asked</dt>
          <dd>
            {formatClock(session.returnRequestedAt)}
            {pastDue > 0 ? ` (${formatMinutes(pastDue)} after due)` : ' (on time)'}
          </dd>
        </div>
        <div>
          <dt>Student says</dt>
          <dd>{label(session.conditionClaimed)}</dd>
        </div>
      </dl>
      {session.conditionNote && <p className="sd-quote">Student note: {session.conditionNote}</p>}

      <div className="sd-check">
        <label className="field">
          <span>Condition you see</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} disabled={busy}>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        {damaged && (
          <label className="field">
            <span>Damage note (goes into the damage report)</span>
            <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </label>
        )}
      </div>

      <div className="sd-actions">
        <button type="button" className={damaged ? 'sd-danger' : ''} disabled={busy} onClick={confirm}>
          {busy ? 'Working...' : damaged ? 'Confirm and report damage' : 'Confirm return'}
        </button>
        {!mismatching && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setMismatching(true)}>
            Wrong item?
          </button>
        )}
      </div>

      {mismatching && (
        <div className="sd-reject">
          <label className="field">
            <span>What did you see? (for example the ID printed on the item)</span>
            <input value={mismatchNote} onChange={(e) => setMismatchNote(e.target.value)} maxLength={300} placeholder="e.g. The ball says FB-012" />
          </label>
          <div className="sd-actions">
            <button type="button" className="sd-danger" disabled={busy || mismatchNote.trim().length < 3} onClick={flag}>
              Flag mismatch
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setMismatching(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function PendingReturns() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getPendingReturns({ limit: 50 });
      setRows(res.data.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load the returns. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 10000);

  const handleResult = (result) => {
    setNotice(result);
    load();
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Staff desk</p>
        <h1>Pending returns</h1>
        <p className="page-sub">Check that the item matches the unit ID and its condition, then confirm. Oldest first.</p>
      </div>

      {notice && (
        <p className={`notice sd-notice ${notice.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {notice.text}
        </p>
      )}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="sd-empty">Loading...</p>
      ) : rows.length === 0 && !error ? (
        <p className="sd-empty">No returns are waiting.</p>
      ) : (
        <ul className="sd-list">
          {rows.map((s) => (
            <ReturnCard key={s._id} session={s} onResult={handleResult} />
          ))}
        </ul>
      )}
    </>
  );
}

export default PendingReturns;