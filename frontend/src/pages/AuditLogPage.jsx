import { useState, useEffect } from 'react';
import { getAuditLogs } from '../api/audit';
import './AuditLogPage.css';

const PAGE_SIZE = 50;

function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [action, setAction] = useState('');               // text typed in the box
  const [appliedAction, setAppliedAction] = useState(''); // filter actually used
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // ignore an old reply if page/filter changed meanwhile
    setLoading(true);
    setError('');
    getAuditLogs({ page, limit: PAGE_SIZE, action: appliedAction || undefined })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.data.logs);
        setPages(res.data.pages || 1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load the audit log.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, appliedAction]);

  const applyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedAction(action.trim().toUpperCase());
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Audit log</h1>
        <p className="page-sub">Who did what and when. Entries cannot be edited or deleted.</p>
      </div>

      <form className="al-filter" onSubmit={applyFilter}>
        <input
          type="text"
          placeholder="Filter by action, e.g. SETTINGS_UPDATED"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        />
        <button type="submit">Filter</button>
      </form>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 && !error ? (
        <p>No entries yet.</p>
      ) : (
        <div className="card al-wrap">
          <table className="al-table">
            <thead>
              <tr><th>Time</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.at).toLocaleString()}</td>
                  <td>{l.actor ? `${l.actor.name} (${l.actor.role})` : 'System'}</td>
                  <td><code>{l.action}</code></td>
                  <td>{l.entityType}{l.entityId ? ` ${l.entityId.slice(-6)}` : ''}</td>
                  <td className="al-meta">{Object.keys(l.meta || {}).length ? JSON.stringify(l.meta) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="al-pager">
        <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </>
  );
}

export default AuditLogPage;
