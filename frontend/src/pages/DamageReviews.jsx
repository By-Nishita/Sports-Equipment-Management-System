import { useState, useEffect } from 'react';
import { getDamageReports, reviewDamageReport } from '../api/damageReports';
import '../components/DamageReportRow.css';
import './DamageReviews.css';

const TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: '', label: 'All' }
];

const STATUS_LABEL = { PENDING: 'Pending', UNDER_REVIEW: 'Under review', RESOLVED: 'Resolved' };
const RESOLUTION_LABEL = { REPAIRED: 'Repaired', RETIRED: 'Removed from use', LOST: 'Marked lost' };

// Ek report ka card + uske review ke button. Apni halat (note, choice) khud sambhalta hai.
function ReviewCard({ report, onChanged }) {
  const [resolution, setResolution] = useState('REPAIRED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { equipment, reportedBy, type, description, status } = report;
  const open = status !== 'RESOLVED';

  const send = async (body) => {
    setBusy(true);
    setError('');
    try {
      const res = await reviewDamageReport(report._id, { ...body, staffNote: note });
      onChanged(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the report. Please try again.');
      setBusy(false);
    }
  };

  return (
    <li className="card dv-row">
      <div className="dr-head">
        <strong>
          {equipment?.name || 'Unknown item'}
          {equipment?.equipmentId && <span className="dr-id"> {equipment.equipmentId}</span>}
        </strong>
        <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
      </div>

      <p className="dr-type">
        {type === 'LOSS' ? 'Lost' : 'Damaged'} &middot; reported by {reportedBy?.name || 'unknown'}
        {reportedBy?.srn ? ` (${reportedBy.srn})` : ''} &middot; {new Date(report.createdAt).toLocaleString()}
      </p>
      <p>{description}</p>

      <p className="dv-item">
        Item status now:{' '}
        <span className={`badge badge-${(equipment?.status || 'available').toLowerCase()}`}>
          {equipment?.status || 'UNKNOWN'}
        </span>
      </p>

      {!open && (
        <p className="dr-outcome">
          {RESOLUTION_LABEL[report.resolution] || report.resolution}
          {report.reviewedBy?.name ? ` by ${report.reviewedBy.name}` : ''}
        </p>
      )}
      {report.staffNote && <p className="dr-note">Staff note: {report.staffNote}</p>}

      {open && (
        <div className="dv-actions">
          <label className="field">
            <span>Staff note (optional)</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="dv-buttons">
            {status === 'PENDING' && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => send({ status: 'UNDER_REVIEW' })}
              >
                Start review
              </button>
            )}

            <select
              aria-label="Final decision"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              disabled={busy}
            >
              <option value="REPAIRED">Repaired, back in use</option>
              <option value="RETIRED">Remove from use</option>
              <option value="LOST">Mark as lost</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ status: 'RESOLVED', resolution })}
            >
              {busy ? 'Saving...' : 'Resolve'}
            </button>
          </div>

          {error && <p className="notice notice-error" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}

function DamageReviews() {
  const [tab, setTab] = useState('PENDING');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // badalte hi list dobara aati hai

  useEffect(() => {
    let cancelled = false; // tab jaldi badal gaya to purana jawab ignore karo
    setLoading(true);
    setError('');
    getDamageReports(tab)
      .then((res) => {
        if (!cancelled) setReports(res.data.reports);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load reports. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const handleChanged = (message) => {
    setNotice(message);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Damage reviews</h1>
        <p className="page-sub">Check reported items, then repair, retire or mark them lost.</p>
      </div>

      <div className="seg dv-tabs" role="group" aria-label="Report status">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={tab === t.value ? 'seg-on' : ''}
            aria-pressed={tab === t.value}
            onClick={() => {
              setNotice('');
              setTab(t.value);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && <p className="notice notice-ok" role="status">{notice}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="dv-empty">Loading...</p>
      ) : !error && reports.length === 0 ? (
        <p className="dv-empty">No reports here.</p>
      ) : (
        <ul className="dv-list">
          {reports.map((r) => (
            <ReviewCard key={r._id} report={r} onChanged={handleChanged} />
          ))}
        </ul>
      )}
    </>
  );
}

export default DamageReviews;
