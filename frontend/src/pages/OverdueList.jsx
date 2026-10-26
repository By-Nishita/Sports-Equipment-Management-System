import { useState, useCallback } from 'react';
import { getOverdueSessions } from '../api/sessions';
import usePolling from '../hooks/usePolling';
import { formatTime, formatMinutes } from '../utils/time';
import './StaffDesk.css';

// Items that are out and past their due time, the most late first.
function OverdueList() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getOverdueSessions({ limit: 100 });
      setRows(res.data.data);
      setTotal(res.data.pagination?.total ?? res.data.data.length);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the overdue list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 30000);

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Staff desk</p>
        <h1>Overdue items</h1>
        <p className="page-sub">Items that are still out after their due time. Most late first.</p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="sd-empty">Loading...</p>
      ) : rows.length === 0 && !error ? (
        <p className="sd-empty">Nothing is overdue.</p>
      ) : (
        <div className="card sd-table-wrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Item</th>
                <th>Student</th>
                <th>SRN</th>
                <th>Phone</th>
                <th>Was due</th>
                <th>Late by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id} className="sd-row-late">
                  <td className="sd-cell-code">{s.unit?.unitCode || '-'}</td>
                  <td>{s.type?.name || 'Unknown item'}</td>
                  <td>{s.user?.name || 'Unknown student'}</td>
                  <td>{s.user?.srn || '-'}</td>
                  <td>{s.user?.phone ? <a href={`tel:${s.user.phone}`}>{s.user.phone}</a> : '-'}</td>
                  <td>{formatTime(s.dueAt)}</td>
                  <td className="sd-late">{formatMinutes(s.minutesLate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > rows.length && <p className="sd-more">Showing {rows.length} of {total}.</p>}
        </div>
      )}
    </>
  );
}

export default OverdueList;
