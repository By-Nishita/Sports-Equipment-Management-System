import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMySessions, cancelRequest } from '../api/sessions';
import TypeThumb from '../components/TypeThumb';
import { formatTime, formatMinutes, minutesSince } from '../utils/time';
import './MySessions.css';

// Badge of one session (the .badge-* classes are in index.css)
const badgeOf = (session) => {
  switch (session.status) {
    case 'ISSUE_PENDING':
      return { cls: 'badge-maintenance', label: 'Waiting for approval' };
    case 'ACTIVE':
      return session.isOverdue
        ? { cls: 'badge-damaged', label: 'Overdue' }
        : { cls: 'badge-in_use', label: 'In use' };
    case 'RETURN_PENDING':
      return { cls: 'badge-maintenance', label: 'Return requested' };
    case 'RETURNED':
      return { cls: 'badge-available', label: 'Returned' };
    case 'REJECTED':
      return { cls: 'badge-retired', label: 'Declined' };
    case 'EXPIRED':
      return { cls: 'badge-retired', label: 'Expired' };
    default:
      return { cls: 'badge-retired', label: session.status };
  }
};

const CONDITION_LABEL = { EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', DAMAGED: 'Damaged' };

// One component for two pages: /my-use (activeOnly = unfinished sessions) and /history (everything)
function MySessions({ activeOnly = false }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore an answer that arrives after the student left the page
    setLoading(true);
    setError('');
    getMySessions(activeOnly ? { open: 'true' } : { page: 1 })
      .then((res) => {
        if (cancelled) return;
        setSessions(res.data.data);
        setPage(1);
        setPages(res.data.pagination?.pages || 1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load your sessions. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOnly, reloadKey]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await getMySessions({ page: page + 1 });
      setSessions((old) => [...old, ...res.data.data]);
      setPage(page + 1);
      setPages(res.data.pagination?.pages || page + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load more. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [page]);

  const cancel = async (session) => {
    setBusyId(session._id);
    setError('');
    try {
      await cancelRequest(session._id);
    } catch (err) {
      setError(err.response?.data?.message || 'This request cannot be cancelled.');
    } finally {
      setBusyId('');
      setReloadKey((k) => k + 1);
    }
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">{activeOnly ? 'Right now' : 'Everything you have used'}</p>
        <h1>{activeOnly ? 'My Active Use' : 'Usage History'}</h1>
        <p className="page-sub">
          {activeOnly
            ? 'Items you have requested or taken and not returned yet.'
            : 'Every request you have made, newest first.'}
        </p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="ms-empty">Loading...</p>
      ) : !error && sessions.length === 0 ? (
        <div className="card ms-blank">
          <p>{activeOnly ? 'You have nothing issued right now.' : 'You have not used any equipment yet.'}</p>
          <button type="button" onClick={() => navigate('/scan')}>Request an item</button>
        </div>
      ) : (
        <>
          <ul className="ms-list">
            {sessions.map((s) => {
              const badge = badgeOf(s);
              const overdueBy = s.isOverdue ? minutesSince(s.dueAt) : 0;
              return (
                <li key={s._id} className="card ms-row">
                  <div className="ms-top">
                    <span className="ms-name">
                      <TypeThumb type={s.type} size={40} />
                      <strong>
                        {s.type?.name || 'Unknown item'}
                        {s.unit?.unitCode && <span className="ms-id"> {s.unit.unitCode}</span>}
                      </strong>
                    </span>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>

                  <dl className="ms-facts">
                    <div>
                      <dt>Requested</dt>
                      <dd>{formatTime(s.requestedAt)}</dd>
                    </div>
                    {s.approvedAt && (
                      <div>
                        <dt>Issued</dt>
                        <dd>{formatTime(s.approvedAt)}</dd>
                      </div>
                    )}
                    {s.status === 'ACTIVE' && (
                      <div>
                        <dt>Return by</dt>
                        <dd>{formatTime(s.dueAt)}</dd>
                      </div>
                    )}
                    {s.returnRequestedAt && (
                      <div>
                        <dt>Return asked</dt>
                        <dd>{formatTime(s.returnRequestedAt)}</dd>
                      </div>
                    )}
                    {s.status === 'RETURNED' && (
                      <>
                        <div>
                          <dt>Confirmed</dt>
                          <dd>{formatTime(s.returnedAt)}</dd>
                        </div>
                        <div>
                          <dt>Used for</dt>
                          <dd>{formatMinutes(s.durationMinutes)}</dd>
                        </div>
                        {s.conditionVerified && (
                          <div>
                            <dt>Condition</dt>
                            <dd>{CONDITION_LABEL[s.conditionVerified] || s.conditionVerified}</dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>

                  {s.status === 'REJECTED' && s.rejectReason && <p className="ms-note">Reason: {s.rejectReason}</p>}
                  {s.isOverdue && <p className="ms-late">Overdue by {formatMinutes(overdueBy)}. Please return it.</p>}
                  {s.wasLate && <p className="ms-late">Returned {formatMinutes(s.lateMinutes)} late.</p>}
                  {s.status === 'RETURN_PENDING' && (
                    <p className="ms-note">Show the item to staff. They will confirm the return.</p>
                  )}

                  {(s.status === 'ACTIVE' || s.status === 'ISSUE_PENDING') && (
                    <div className="ms-actions">
                      {s.status === 'ACTIVE' && (
                        <>
                          <button type="button" onClick={() => navigate(`/return?session=${s._id}`)}>Return this item</button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/report-damage?unit=${encodeURIComponent(s.unit?.unitCode || '')}`)}
                          >
                            Report a problem
                          </button>
                        </>
                      )}
                      {s.status === 'ISSUE_PENDING' && (
                        <>
                          <button type="button" className="btn-secondary" onClick={() => navigate('/scan')}>View request</button>
                          <button type="button" className="btn-secondary" disabled={busyId === s._id} onClick={() => cancel(s)}>
                            {busyId === s._id ? 'Cancelling...' : 'Cancel request'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {!activeOnly && page < pages && (
            <button type="button" className="btn-secondary ms-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </>
  );
}

export default MySessions;