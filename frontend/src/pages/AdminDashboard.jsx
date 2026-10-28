// ============================================================
// Admin Dashboard (/admin): for staff and admin only.
// The page has 4 parts (top to bottom):
//   1. Header (title, Refresh, Scan equipment)
//   2. 4 big cards + 5 small cards (counts)
//   3. Equipment utilization chart + Active equipment panel
//   4. Recent activity table + Inventory health
//   5. Overdue items list
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../api/dashboard';
import { getActiveSessions } from '../api/sessions';
import './AdminDashboard.css';

// ---------- small helper functions ----------

// 130 -> "2 h 10 min"
const formatMinutes = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// "2026-10-12T10:10:00Z" -> "12 Oct"  and  -> "10:10 am"
const formatDay = (value) => new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' });
const formatClock = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Percentage of part out of whole. Returns 0 when whole is 0 (avoids dividing by zero)
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// ---------- icons (line icons, same style as AppShell) ----------
// Each entry is the inside of an SVG. To add a new icon, add one line here,
// then use <Icon name="your-name" /> anywhere.
const ICONS = {
  box: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 12h8" />
    </>
  )
};

// Give a name, get the icon. currentColor means the icon takes its colour from the text colour of its box.
function Icon({ name, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// ---------- small components ----------

// Big card at the top: icon + label + number + one short line below
function StatCard({ icon, tone, label, value, note }) {
  return (
    <div className="card ad-stat">
      <span className={`ad-icon ad-icon-${tone}`}>
        <Icon name={icon} />
      </span>
      <div>
        <p className="ad-stat-label">{label}</p>
        <p className="ad-stat-value">{value}</p>
        <p className="ad-stat-note">{note}</p>
      </div>
    </div>
  );
}

// Small card below. If `to` is given, the whole card becomes a link.
function Mini({ icon, label, value, tone = 'grey', to }) {
  const body = (
    <>
      <span className={`ad-icon ad-icon-sm ad-icon-${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="ad-mini-text">
        <span className="ad-mini-value">{value}</span>
        <span className="ad-mini-label">{label}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="card ad-mini ad-mini-link">
      {body}
    </Link>
  ) : (
    <div className="card ad-mini">{body}</div>
  );
}

// How each session state is shown in the Recent activity table
const SESSION_BADGE = {
  ACTIVE: { cls: 'badge-in_use', label: 'In use' },
  OVERDUE: { cls: 'badge-damaged', label: 'Overdue' },
  RETURNED: { cls: 'badge-available', label: 'Completed' }
};

// Rows of the Inventory health card (key = condition value saved in the database)
const CONDITION_ROWS = [
  { key: 'EXCELLENT', label: 'Excellent', cls: 'ad-bar-ok' },
  { key: 'GOOD', label: 'Good', cls: 'ad-bar-ok' },
  { key: 'FAIR', label: 'Fair', cls: 'ad-bar-warn' },
  { key: 'DAMAGED', label: 'Damaged', cls: 'ad-bar-bad' }
];

// ---------- the page itself ----------

function AdminDashboard() {
  const [stats, setStats] = useState(null); // counts from the backend (/dashboard/stats)
  const [active, setActive] = useState([]); // sessions that are issued right now (late ones are included)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // changes when Refresh is clicked, which re-runs the effect

  // Load both things when the page opens (and again on Refresh)
  useEffect(() => {
    let cancelled = false; // ignore a late response if the user already left the page
    setLoading(true);
    setError('');
    // Ask for both at the same time; if either fails, show an error
    Promise.all([getDashboardStats(), getActiveSessions()])
      .then(([statsRes, activeRes]) => {
        if (cancelled) return;
        setStats(statsRes.data.stats);
        setActive(activeRes.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load the dashboard. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // The overdue list is simply the active sessions that are late
  const overdue = active.filter((s) => s.isOverdue);

  return (
    <>
      {/* 1. Header */}
      <div className="page-head ad-head">
        <div>
          <p className="page-eyebrow">Administration</p>
          <h1>Admin Dashboard</h1>
          <p className="page-sub">What is happening in the sports room right now.</p>
        </div>
        <div className="ad-head-actions">
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReloadKey((k) => k + 1)}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <Link to="/scan" className="ad-scan">
            <Icon name="scan" />
            Scan equipment
          </Link>
        </div>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading && !stats && !error && <p className="ad-empty">Loading...</p>}

      {/* Everything below shows only after the data has arrived */}
      {stats && (
        <>
          {/* 2a. The 4 big cards at the top */}
          <section className="ad-stats" aria-label="Equipment summary">
            <StatCard
              icon="box"
              tone="grey"
              label="Total equipment"
              value={stats.equipment.total}
              note={`${stats.equipment.lost + stats.equipment.retired} lost or retired`}
            />
            <StatCard
              icon="check"
              tone="green"
              label="Available now"
              value={stats.equipment.available}
              note={`${percent(stats.equipment.available, stats.equipment.total)}% of inventory`}
            />
            <StatCard
              icon="pulse"
              tone="blue"
              label="Currently in use"
              value={stats.equipment.inUse}
              note="Live checkouts"
            />
            <StatCard
              icon="wrench"
              tone="amber"
              label="Maintenance"
              value={stats.equipment.maintenance}
              note={`${stats.equipment.damaged} damaged`}
            />
          </section>

          {/* 2b. The 5 small cards (red/yellow only when the number is above 0) */}
          <section className="ad-minis" aria-label="Needs attention">
            <Mini
              icon="alert"
              label="Damaged items"
              value={stats.equipment.damaged}
              tone={stats.equipment.damaged > 0 ? 'red' : 'grey'}
            />
            <Mini
              icon="clock"
              label="Overdue"
              value={stats.sessions.overdue}
              tone={stats.sessions.overdue > 0 ? 'red' : 'grey'}
            />
            <Mini
              icon="clipboard"
              label="Damage reports pending"
              value={stats.damageReports.pending}
              tone={stats.damageReports.pending > 0 ? 'amber' : 'grey'}
              to="/admin/damage"
            />
            <Mini
              icon="eye"
              label="Reports under review"
              value={stats.damageReports.underReview}
              tone="grey"
              to="/admin/damage"
            />
          </section>

          {/* 3. Utilization chart (left) and Active equipment (right) */}
          <div className="ad-row2">
            <section className="card ad-panel">
              <h3>Equipment utilization</h3>
              <p className="ad-panel-sub">Usage hours from returned sessions, last 7 days</p>

              {(() => {
                const days = stats.utilization.days;
                // The tallest bar is 100% of the chart height (at least 0.5 so an empty week does not divide by 0)
                const max = Math.max(...days.map((d) => d.hours), 0.5);
                return (
                  <div
                    className="ad-chart"
                    role="img"
                    aria-label={`${stats.utilization.totalHours} usage hours in the last 7 days`}
                  >
                    {days.map((d) => (
                      <div key={d.date} className="ad-col" title={`${d.label}: ${d.hours} h`}>
                        <span className="ad-col-value">{d.hours > 0 ? d.hours : ''}</span>
                        {/* height is this day's share of the tallest day; a day with usage never shrinks below 4% */}
                        <span
                          className="ad-col-bar"
                          style={{ height: `${Math.max((d.hours / max) * 100, d.hours > 0 ? 4 : 0)}%` }}
                        />
                        <span className="ad-col-label">{d.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p className="ad-chart-foot">
                <strong>{stats.utilization.totalHours} h</strong> total usage
                {/* changePercent is null when last week had no usage, because a % of 0 means nothing */}
                {stats.utilization.changePercent != null && (
                  <span className={stats.utilization.changePercent >= 0 ? 'ad-up' : 'ad-down'}>
                    {' '}
                    {stats.utilization.changePercent >= 0 ? '+' : ''}
                    {stats.utilization.changePercent}% vs last week
                  </span>
                )}
              </p>
            </section>

            <section className="card ad-panel">
              <h3>Active equipment</h3>
              <p className="ad-panel-sub">Real-time checkouts</p>

              {active.length === 0 ? (
                <p className="ad-empty">Nothing is checked out right now.</p>
              ) : (
                <ul className="ad-live">
                  {/* show only the first 6; the rest are counted in "+ N more" below */}
                  {active.slice(0, 6).map((s) => (
                    <li key={s._id}>
                      {/* there is no photo yet, so show the first letter of the item name */}
                      <span className="ad-thumb" aria-hidden="true">
                      {(s.type?.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="ad-live-text">
                        <strong>{s.type?.name || 'Unknown item'}</strong>
                        <small>
                          {s.unit?.unitCode} &middot; checked out by {s.user?.name || 'unknown'}
                        </small>
                      </div>
                      {s.isOverdue ? (
                        <span className="badge badge-damaged">Overdue</span>
                      ) : (
                        <span className="ad-livetag">Live</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {active.length > 6 && <p className="ad-more">+ {active.length - 6} more checked out</p>}
            </section>
          </div>

          {/* 4. Recent activity (left) and Inventory health (right) */}
          <div className="ad-row3">
            <section className="card ad-panel">
              <h3>Recent activity</h3>
              <p className="ad-panel-sub">Latest equipment transactions</p>

              {stats.recentSessions.length === 0 ? (
                <p className="ad-empty">No activity yet.</p>
              ) : (
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>User</th>
                        <th>Date</th>
                        <th>Session</th>
                        <th>Duration</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentSessions.map((s) => {
                        const badge = SESSION_BADGE[s.state] || SESSION_BADGE.ACTIVE;
                        return (
                          <tr key={s._id}>
                            <td>
                              <strong>{s.equipment?.name || 'Unknown item'}</strong>
                              <small>{s.equipment?.equipmentId}</small>
                            </td>
                            <td>{s.user?.name || 'Unknown'}</td>
                            <td>{formatDay(s.issuedAt)}</td>
                            {/* a session that is not returned yet has no end time */}
                            <td>
                              {formatClock(s.issuedAt)} &ndash; {s.returnedAt ? formatClock(s.returnedAt) : 'now'}
                            </td>
                            <td>{s.state === 'RETURNED' ? formatMinutes(s.durationMinutes) : '-'}</td>
                            <td>
                              <span className={`badge ${badge.cls}`}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card ad-panel">
              <h3>Inventory health</h3>
              <p className="ad-panel-sub">Condition overview</p>

              <ul className="ad-health">
                {CONDITION_ROWS.map((row) => {
                  const count = stats.inventory.conditions[row.key] || 0;
                  return (
                    <li key={row.key}>
                      <span>{row.label}</span>
                      {/* bar width = this condition's share of all equipment */}
                      <span className="ad-track">
                        <span
                          className={`ad-fill ${row.cls}`}
                          style={{ width: `${percent(count, stats.equipment.total)}%` }}
                        />
                      </span>
                      <strong>{count}</strong>
                    </li>
                  );
                })}
              </ul>

              <div className="ad-value-row">
                <span>Inventory value</span>
                <strong>&#8377;{Number(stats.inventory.value).toLocaleString('en-IN')}</strong>
              </div>
              <p className="ad-panel-sub">Only items with a price are counted. Lost and retired items are left out.</p>
            </section>
          </div>

          {/* 5. Overdue items: who is late and by how much */}
          <section className="ad-section">
            <h3>Overdue items</h3>
            {overdue.length === 0 ? (
              <p className="ad-empty">Nothing is overdue.</p>
            ) : (
              <ul className="ad-list">
                {overdue.map((s) => {
                  // minutes late (at least 1)
                  const lateBy = Math.max(1, Math.round((Date.now() - new Date(s.dueAt)) / 60000));
                  return (
                    <li key={s._id} className="card ad-row">
                      <div>
                        <strong>
                          {s.type?.name || 'Unknown item'}
                          {s.unit?.unitCode && <span className="ad-id"> {s.unit.unitCode}</span>}
                        </strong>
                        <p className="ad-who">
                          {s.user?.name || 'Unknown student'}
                          {s.user?.srn ? ` (${s.user.srn})` : ''}
                          {s.user?.phone ? ` · ${s.user.phone}` : ''}
                        </p>
                      </div>
                      <div className="ad-late">
                        <span className="badge badge-damaged">Overdue {formatMinutes(lateBy)}</span>
                        <small>due {new Date(s.dueAt).toLocaleString()}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="ad-stamp">Updated {new Date(stats.generatedAt).toLocaleTimeString()}</p>
        </>
      )}
    </>
  );
}

export default AdminDashboard;
