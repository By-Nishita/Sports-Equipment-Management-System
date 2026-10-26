import { useState, useEffect, useCallback } from 'react';
import { getPendingApprovals, approveRequest, rejectRequest } from '../api/sessions';
import { getAvailableUnits } from '../api/equipmentTypes';
import TypeThumb from '../components/TypeThumb';
import usePolling from '../hooks/usePolling';
import { formatAgo } from '../utils/time';
import './StaffDesk.css';

const errorText = (err, fallback) => err.response?.data?.message || fallback;

// One waiting request. It keeps its own typing, so the 10-second refresh of the list
// does not wipe what staff has typed (the card is matched by its id).
function ApprovalCard({ session, onResult }) {
  const type = session.type || {};
  const student = session.user || {};

  const [unitCode, setUnitCode] = useState('');
  const [units, setUnits] = useState(null); // null = still loading
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const loadUnits = useCallback(async () => {
    try {
      const res = await getAvailableUnits(type._id);
      setUnits(res.data.data);
    } catch {
      setUnits([]);
    }
  }, [type._id]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const code = unitCode.trim().toUpperCase();

  const approve = async (e) => {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    try {
      await approveRequest(session._id, code);
      onResult({ ok: true, text: `Approved: ${code} given to ${student.name || 'the student'}.` });
    } catch (err) {
      onResult({ ok: false, text: errorText(err, 'Could not approve. Please try again.') });
      loadUnits(); // the unit list may be out of date
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await rejectRequest(session._id, reason.trim());
      onResult({ ok: true, text: `Request from ${student.name || 'the student'} was rejected.` });
    } catch (err) {
      onResult({ ok: false, text: errorText(err, 'Could not reject. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card sd-card">
      <div className="sd-top">
        <TypeThumb type={type} size={64} />
        <div className="sd-title">
          <h2>{type.name || 'Item'}</h2>
          <p className="sd-sub">
            <strong>{student.name || 'Unknown student'}</strong>
            {student.srn ? ` - ${student.srn}` : ''}
            {student.phone ? ` - ${student.phone}` : ''}
          </p>
        </div>
        <span className="sd-when">Asked {formatAgo(session.requestedAt)}</span>
      </div>

      <form className="sd-approve" onSubmit={approve}>
        <label className="field">
          <span>Unit ID you are handing over</span>
          <input
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
            placeholder="e.g. FB-007"
            list={`units-${session._id}`}
            autoComplete="off"
            maxLength={20}
          />
          <datalist id={`units-${session._id}`}>
            {(units || []).map((u) => (
              <option key={u._id} value={u.unitCode} />
            ))}
          </datalist>
        </label>

        {units && units.length > 0 && (
          <div className="sd-chips" aria-label="Available units">
            {units.slice(0, 8).map((u) => (
              <button
                key={u._id}
                type="button"
                className={u.unitCode === code ? 'sd-chip sd-chip-on' : 'sd-chip btn-secondary'}
                onClick={() => setUnitCode(u.unitCode)}
              >
                {u.unitCode}
              </button>
            ))}
            {units.length > 8 && <span className="sd-more">+ {units.length - 8} more, type the ID</span>}
          </div>
        )}
        {units && units.length === 0 && <p className="sd-warn">No unit of this type is available right now.</p>}

        <div className="sd-actions">
          <button type="submit" disabled={!code || busy}>
            {busy ? 'Working...' : 'Approve'}
          </button>
          {!rejecting && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          )}
        </div>
      </form>

      {rejecting && (
        <div className="sd-reject">
          <label className="field">
            <span>Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Court is closed" />
          </label>
          <div className="sd-actions">
            <button type="button" className="sd-danger" disabled={busy} onClick={reject}>
              Confirm reject
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StaffApprovals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { ok, text } from the last action

  const load = useCallback(async () => {
    try {
      const res = await getPendingApprovals({ limit: 50 });
      setRows(res.data.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Could not load the requests. Please try again.'));
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
        <h1>Approvals</h1>
        <p className="page-sub">Give the student an item, type its ID, then approve. This list refreshes every 10 seconds.</p>
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
        <p className="sd-empty">No requests are waiting.</p>
      ) : (
        <ul className="sd-list">
          {rows.map((s) => (
            <ApprovalCard key={s._id} session={s} onResult={handleResult} />
          ))}
        </ul>
      )}
    </>
  );
}

export default StaffApprovals;