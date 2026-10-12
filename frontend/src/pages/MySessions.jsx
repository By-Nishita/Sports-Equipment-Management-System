import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMySessions } from '../api/sessions';
import './MySessions.css';

const formatTime = (value) =>
  new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// 75 -> "1 h 15 min"
const formatMinutes = (minutes) => {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// Ek session ka badge: (index.css ke .badge-* classes)
const badgeOf = (session) => {
  if (session.status === 'ACTIVE') {
    return session.isOverdue
      ? { cls: 'badge-damaged', label: 'Overdue' }
      : { cls: 'badge-in_use', label: 'In use' };
  }
  return { cls: 'badge-available', label: 'Returned' };
};

const CONDITION_LABEL = { EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', DAMAGED: 'Damaged' };

// Ek hi component do pages ke liye: /my-use (activeOnly) aur /history (sab)
function MySessions({ activeOnly = false }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // page chhodne ke baad late aaya jawab ignore karo
    getMySessions()
      .then((res) => {
        if (!cancelled) setSessions(res.data.sessions);
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
  }, []);

  const shown = activeOnly ? sessions.filter((s) => s.status === 'ACTIVE') : sessions;

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">{activeOnly ? 'Right now' : 'Everything you have used'}</p>
        <h1>{activeOnly ? 'My Active Use' : 'Usage History'}</h1>
        <p className="page-sub">
          {activeOnly
            ? 'Items you have taken and not returned yet.'
            : 'Every item you have issued, newest first.'}
        </p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {loading ? (
        <p className="ms-empty">Loading...</p>
      ) : !error && shown.length === 0 ? (
        <div className="card ms-blank">
          <p>{activeOnly ? 'You have nothing issued right now.' : 'You have not used any equipment yet.'}</p>
          <button type="button" onClick={() => navigate('/scan')}>Scan an item</button>
        </div>
      ) : (
        <ul className="ms-list">
          {shown.map((s) => {
            const badge = badgeOf(s);
            const overdueBy = s.isOverdue ? Math.round((Date.now() - new Date(s.dueAt)) / 60000) : 0;
            return (
              <li key={s._id} className="card ms-row">
                <div className="ms-top">
                  <strong>
                    {s.equipment?.name || 'Unknown item'}
                    {s.equipment?.equipmentId && <span className="ms-id"> {s.equipment.equipmentId}</span>}
                  </strong>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                </div>

                <dl className="ms-facts">
                  <div>
                    <dt>Issued</dt>
                    <dd>{formatTime(s.issuedAt)}</dd>
                  </div>
                  {s.status === 'ACTIVE' ? (
                    <div>
                      <dt>Return by</dt>
                      <dd>{formatTime(s.dueAt)}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt>Returned</dt>
                        <dd>{formatTime(s.returnedAt)}</dd>
                      </div>
                      <div>
                        <dt>Used for</dt>
                        <dd>{formatMinutes(s.durationMinutes)}</dd>
                      </div>
                      {s.returnCondition && (
                        <div>
                          <dt>Condition</dt>
                          <dd>{CONDITION_LABEL[s.returnCondition] || s.returnCondition}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>

                {s.isOverdue && (
                  <p className="ms-late">Overdue by {formatMinutes(overdueBy)}. Please return it.</p>
                )}
                {s.wasLate && <p className="ms-late">Returned {formatMinutes(s.lateMinutes)} late.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default MySessions;
