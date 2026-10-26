import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './AppShell.css';

// Sidebar yahan ek list se banta hai. Har section par `roles` likha hai,
// isliye student ko Administration wala hissa dikhta hi nahi.
// `soon: true` = page abhi bana nahi, sirf dikhta hai, click nahi hota.
const NAV = [
  {
    heading: 'Sports Room',
    roles: ['student', 'staff', 'admin'],
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
      { label: 'Book Equipment', to: '/book', icon: 'history' },
      { label: 'My Bookings', to: '/my-bookings', icon: 'history' },
      { label: 'Scan QR', to: '/scan', icon: 'scan' },
      { label: 'Return item', to: '/return', icon: 'return' },
      { label: 'My Active Use', to: '/my-use', icon: 'bolt' },
      { label: 'Usage History', to: '/history', icon: 'history' },
      { label: 'Report damage', to: '/report-damage', icon: 'alert' }
    ]
  },
  {
    heading: 'Staff desk',
    roles: ['staff', 'admin'],
    items: [
      { label: 'Approvals', to: '/staff/approvals', icon: 'check' },
      { label: 'Pending returns', to: '/staff/returns', icon: 'return' },
      { label: 'Overdue', to: '/staff/overdue', icon: 'clock' }
    ]
  },
  {
    heading: 'Administration',
    roles: ['staff', 'admin'],
        items: [
      { label: 'Admin Dashboard', to: '/admin', icon: 'shield' },
      { label: 'Damage reviews', to: '/admin/damage', icon: 'alert' }
    ]
  },
  {
    heading: 'Admin only',
    roles: ['admin'],
    items: [
      { label: 'Settings', to: '/admin/settings', icon: 'key' },
      { label: 'Students and staff', to: '/admin/students', icon: 'shield' },
      { label: 'Audit log', to: '/admin/audit-log', icon: 'history' }
    ]
  }
];

const ROLE_LABEL = { student: 'Student', staff: 'Sports staff', admin: 'Admin' };

const ICONS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 12h8" />
    </>
  ),
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  return: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

// localStorage kharab ho ya khaali ho to bhi page na tute
function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
}

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// Ye ek LAYOUT hai: App.jsx mein har logged-in route isi ke andar hai, isliye sidebar aur
// top bar page badalne par bhi wahi rehte hain. Page ka content <Outlet /> mein aata hai.
function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const user = readUser();
  const role = user.role || 'student';
  const forced = user.mustChangePassword === true; // locked until the password is changed
    

  // Top bar ka naam URL se: menu ki list mein jo item is URL ka hai, uska label
  const crumb =
    NAV.flatMap((group) => group.items).find((item) => item.to === pathname)?.label ||
    (pathname === '/change-password' ? 'Change password' : '');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="shell">
      {open && <div className="shell-scrim" onClick={() => setOpen(false)} />}

      <aside className={open ? 'shell-side shell-side-open' : 'shell-side'} aria-label="Main menu">
        <div className="shell-brand">
          <span className="shell-logo" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="6" y="6" width="28" height="28" rx="2" />
              <path d="M6 20h28" />
              <circle cx="20" cy="20" r="5" />
            </svg>
          </span>
          <span className="shell-brand-name">Sports Room</span>
        </div>

        <nav className="shell-nav">
            {NAV.filter((group) => !forced && group.roles.includes(role)).map((group) => (            <div key={group.heading} className="shell-group">
              <p className="shell-heading">{group.heading}</p>
              {group.items.map((item) =>
                item.soon ? (
                  <span key={item.label} className="shell-item shell-item-soon" aria-disabled="true">
                    <Icon name={item.icon} />
                    {item.label}
                    <small>Soon</small>
                  </span>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end
                    className={({ isActive }) => (isActive ? 'shell-item shell-item-on' : 'shell-item')}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                )
              )}
            </div>
          ))}
        </nav>

        <div className="shell-me">
          <div className="shell-me-head">
            <span className="shell-avatar">{initialsOf(user.name)}</span>
            <span className="shell-me-text">
              <strong>{user.name || 'Signed in'}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <NavLink
            to="/change-password"
            className={({ isActive }) => (isActive ? 'shell-item shell-item-on' : 'shell-item')}
            onClick={() => setOpen(false)}
          >
            <Icon name="key" />
            Change password
          </NavLink>
          <button type="button" className="shell-item shell-logout" onClick={handleLogout}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-top">
          <button
            type="button"
            className="shell-burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <p className="shell-crumb">
            Sports Room <span aria-hidden="true">/</span> <strong>{crumb}</strong>
          </p>
          <div className="shell-user">
            <span className="shell-avatar">{initialsOf(user.name)}</span>
            <span className="shell-user-text">
              <strong>{user.name || 'Signed in'}</strong>
              <small>{ROLE_LABEL[role] || role}</small>
            </span>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;

