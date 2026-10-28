import { useState, useEffect, useCallback } from 'react';
import { getDamageReports, verifyDamageReport, resolveDamageReport } from '../api/damageReports';
import { formatTime } from '../utils/time';
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

// The unit is physically with a student: it cannot be resolved until it comes back
const WITH_STUDENT = ['IN_USE', 'RETURN_PENDING'];

const currentRole = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))?.role || 'student';
  } catch {
    return 'student';
  }
};

// One report as a card. Staff see "Verify". Only admin sees "Resolve".
function ReviewCard({ report, isAdmin, onResult }) {
  const [resolution, setResolution] = useState('REPAIRED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { unit, reportedBy, verifiedBy, resolvedBy, type, description, status, source } = report;
  const open = status !== 'RESOLVED';
  const withStudent = WITH_STUDENT.includes(unit?.status);
  // A report made by a damaged return was already checked by staff at the counter
  const checkedAtCounter = status === 'PENDING' && Boolean(verifiedBy);

  const run = async (action) => {
    setBusy(true);
    try {
      const res = await action();
      onResult({ ok: true, text: res.data.message });
    } catch (err) {
      onResult({ ok: false, text: err.response?.data?.message || 'Could not update the report. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card dv-row">
      <div className="dr-head">
        <strong>
          {unit?.type?.name || 'Unknown item'}
          {unit?.unitCode && <span className="dr-id"> {unit.unitCode}</span>}
        </strong>
        <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
      </div>

      <p className="dr-type">
        {type === 'LOSS' ? 'Lost' : 'Damaged'} &middot; {source === 'RETURN' ? 'found at return' : 'reported'} by{' '}
        {reportedBy?.name || 'unknown'}
        {reportedBy?.srn ? ` (${reportedBy.srn})` : ''} &middot; {formatTime(report.createdAt)}
      </p>
      <p>{description}</p>

      <p className="dv-item">
        Item status now:{' '}
        <span className={`badge badge-${(unit?.status || 'available').toLowerCase()}`}>{unit?.status || 'UNKNOWN'}</span>
      </p>

      {verifiedBy && (
        <p className="dr-note">
          Checked by {verifiedBy.name}
          {report.verifiedAt ? ` on ${formatTime(report.verifiedAt)}` : ''}
        </p>
      )}
      {!open && (
        <p className="dr-outcome">
          {RESOLUTION_LABEL[report.resolution] || report.resolution}
          {resolvedBy?.name ? ` by ${resolvedBy.name}` : ''}
        </p>
      )}
      {report.staffNote && <p className="dr-note">Staff note: {report.staffNote}</p>}

      {open && (
        <div className="dv-actions">
          <label className="field">
            <span>Note (optional)</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </label>

          <div className="dv-buttons">
            {status === 'PENDING' && !checkedAtCounter && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => run(() => verifyDamageReport(report._id, note))}
              >
                Verify (I have checked it)
              </button>
            )}
            {checkedAtCounter && <span className="dv-hint">Already checked at the counter.</span>}

            {isAdmin ? (
              <>
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
                  disabled={busy || withStudent}
                  onClick={() => run(() => resolveDamageReport(report._id, { resolution, note }))}
                >
                  {busy ? 'Saving...' : 'Resolve'}
                </button>
              </>
            ) : (
              <span className="dv-hint">Only an admin can resolve a report.</span>
            )}
          </div>
          {isAdmin && withStudent && (
            <p className="dv-hint">This item is with a student. Resolve it after it is returned.</p>
          )}
        </div>
      )}
    </li>
  );
}

function DamageReviews() {
  const isAdmin = currentRole() === 'admin';
  const [tab, setTab] = useState('PENDING');
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { ok, text }
  const [reloadKey, setReloadKey] = useState(0); // changing it loads the list again

  useEffect(() => {
    let cancelled = false; // the tab changed quickly: ignore the old answer
    setLoading(true);
    setError('');
    getDamageReports({ status: tab || undefined, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setReports(res.data.data);
        setPage(1);
        setPages(res.data.pagination?.pages || 1);
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

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await getDamageReports({ status: tab || undefined, page: page + 1 });
      setReports((old) => [...old, ...res.data.data]);
      setPage(page + 1);
      setPages(res.data.pagination?.pages || page + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load more. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [tab, page]);

  const handleResult = (result) => {
    setNotice(result);
    setReloadKey((k) => k + 1);
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Damage reviews</h1>
        <p className="page-sub">
          {isAdmin
            ? 'Check reported items, then repair, retire or mark them lost.'
            : 'Check reported items and verify them. An admin makes the final decision.'}
        </p>
      </div>

      <div className="seg dv-tabs" role="group" aria-label="Report status">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={tab === t.value ? 'seg-on' : ''}
            aria-pressed={tab === t.value}
            onClick={() => {
              setNotice(null);
              setTab(t.value);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className={`notice ${notice.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {notice.text}
        </p>
      )}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="dv-empty">Loading...</p>
      ) : !error && reports.length === 0 ? (
        <p className="dv-empty">No reports here.</p>
      ) : (
        <>
          <ul className="dv-list">
            {reports.map((r) => (
              <ReviewCard key={r._id} report={r} isAdmin={isAdmin} onResult={handleResult} />
            ))}
          </ul>
          {page < pages && (
            <button type="button" className="btn-secondary dv-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </>
  );
}

export default DamageReviews;
