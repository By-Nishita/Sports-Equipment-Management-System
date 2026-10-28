import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePolling from '../hooks/usePolling';
import TypeThumb from '../components/TypeThumb';
import { getMySessions, getPendingApprovals, getPendingReturns, getOverdueSessions } from '../api/sessions';
import { getMyProfile } from '../api/users';
import { formatTime, formatMinutes, minutesUntil } from '../utils/time';
import './Dashboard.css';

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
};

const LOW_MINUTES = 10; // "5 min left" turns yellow

// ------------------------------------------------------------------ student home
function HeldCard({ session, navigate }) {
  const { type, unit, status, dueAt } = session;
  const left = dueAt ? minutesUntil(dueAt) : null;

  let timeText = '';
  let timeClass = 'dh-time';
  if (status === 'RETURN_PENDING') {
    timeText = 'Waiting for staff to confirm the return';
  } else if (left !== null && left <= 0) {
    timeText = `Overdue by ${formatMinutes(-left)}`;
    timeClass += ' dh-time-late';
  } else if (left !== null) {
    timeText = `${formatMinutes(left)} left (return by ${formatTime(dueAt)})`;
    if (left <= LOW_MINUTES) timeClass += ' dh-time-low';
  }

  return (
    <li className="card dh-held">
      <TypeThumb type={type} size={48} />
      <div className="dh-held-body">
        <strong>
          {type?.name || 'Item'}
          {unit?.unitCode && <span className="dh-code"> {unit.unitCode}</span>}
        </strong>
        <p className={timeClass}>{timeText}</p>
      </div>
      {status === 'ACTIVE' && (
        <div className="dh-held-actions">
          <button type="button" onClick={() => navigate(`/return?session=${session._id}`)}>Return</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/report-damage?unit=${encodeURIComponent(unit?.unitCode || '')}`)}
          >
            Report a problem
          </button>
        </div>
      )}
    </li>
  );
}

function Stat({ value, label }) {
  return (
    <div className="card dh-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StudentHome({ firstName }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getMySessions({ open: 'true' });
      setSessions(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 10000);

  // The stats change slowly: load them once
  useEffect(() => {
    getMyProfile()
      .then((res) => setStats(res.data.data.stats))
      .catch(() => setStats(null));
  }, []);

  const held = sessions.filter((s) => s.status === 'ACTIVE' || s.status === 'RETURN_PENDING');
  const waiting = sessions.filter((s) => s.status === 'ISSUE_PENDING');

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Welcome back</p>
        <h1>Hi, {firstName}</h1>
        <p className="page-sub">Scan the QR code on an item to borrow it.</p>
      </div>

      <button type="button" className="dh-scan" onClick={() => navigate('/scan')}>
        Scan an item
      </button>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {waiting.length > 0 && (
        <section aria-labelledby="dh-waiting">
          <h2 id="dh-waiting">Waiting for approval</h2>
          <ul className="dh-list">
            {waiting.map((s) => (
              <li key={s._id} className="card dh-held">
                <TypeThumb type={s.type} size={48} />
                <div className="dh-held-body">
                  <strong>{s.type?.name || 'Item'}</strong>
                  <p className="dh-time">Asked at {formatTime(s.requestedAt)}. Show your ID to the staff.</p>
                </div>
                <div className="dh-held-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate('/scan')}>View request</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="dh-held">
        <h2 id="dh-held">Items you hold</h2>
        {loading ? (
          <p className="dh-empty">Loading...</p>
        ) : held.length === 0 ? (
          <p className="dh-empty">You are not holding anything right now.</p>
        ) : (
          <ul className="dh-list">
            {held.map((s) => (
              <HeldCard key={s._id} session={s} navigate={navigate} />
            ))}
          </ul>
        )}
      </section>

      {stats && (
        <section aria-labelledby="dh-stats">
          <h2 id="dh-stats">Your numbers</h2>
          <div className="dh-stats">
            <Stat value={stats.totalSessions} label="Items used" />
            <Stat value={stats.totalHours} label="Hours" />
            <Stat value={stats.onTimePercent === null ? '-' : `${stats.onTimePercent}%`} label="Returned on time" />
          </div>
        </section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ staff / admin home
function DeskCard({ count, label, to, alert }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`card dh-desk${alert && count > 0 ? ' dh-desk-alert' : ''}`}
      onClick={() => navigate(to)}
    >
      <strong>{count === null ? '...' : count}</strong>
      <span>{label}</span>
    </button>
  );
}

function StaffHome({ firstName, isAdmin }) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ approvals: null, returns: null, overdue: null });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // limit=1: we only want the total, not the rows
      const [a, r, o] = await Promise.all([
        getPendingApprovals({ limit: 1 }),
        getPendingReturns({ limit: 1 }),
        getOverdueSessions({ limit: 1 })
      ]);
      setCounts({
        approvals: a.data.pagination?.total ?? a.data.data.length,
        returns: r.data.pagination?.total ?? r.data.data.length,
        overdue: o.data.pagination?.total ?? o.data.data.length
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the counts. Please try again.');
    }
  }, []);
  usePolling(load, 10000);

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">{isAdmin ? 'Admin' : 'Staff desk'}</p>
        <h1>Hi, {firstName}</h1>
        <p className="page-sub">What needs you at the counter right now.</p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="dh-desks">
        <DeskCard count={counts.approvals} label="Requests to approve" to="/staff/approvals" />
        <DeskCard count={counts.returns} label="Returns to confirm" to="/staff/returns" />
        <DeskCard count={counts.overdue} label="Overdue items" to="/staff/overdue" alert />
      </div>

      <div className="dh-links">
        <button type="button" className="btn-secondary" onClick={() => navigate('/admin/damage')}>Damage reviews</button>
        {isAdmin && (
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin')}>Admin dashboard</button>
        )}
      </div>
    </>
  );
}

function Dashboard() {
  const user = readUser();
  const role = user.role || 'student';
  const firstName = (user.name || '').trim().split(/\s+/)[0] || 'there';

  return role === 'student' ? (
    <StudentHome firstName={firstName} />
  ) : (
    <StaffHome firstName={firstName} isAdmin={role === 'admin'} />
  );
}

export default Dashboard;
