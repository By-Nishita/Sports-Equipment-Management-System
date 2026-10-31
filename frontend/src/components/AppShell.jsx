import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import universityLogo from '../assets/vishwakarma-university.png';
import sportsCouncilLogo from '../assets/vishwakarma-sports-council.png';
import './AppShell.css';

const NAV = [
  // ---------- Student ----------
  {
    heading: 'Sports Room',
    roles: ['student'],
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
      { label: 'Equipment Catalog', to: '/catalog', icon: 'grid' },
      { label: 'Scan QR', to: '/scan', icon: 'scan' },
      { label: 'My Active Use', to: '/my-use', icon: 'bolt' },
      { label: 'Return item', to: '/return', icon: 'return' },
      { label: 'Usage History', to: '/history', icon: 'history' },
      { label: 'Report damage', to: '/report-damage', icon: 'alert' }
    ]
  },

  // ---------- Staff ----------
  {
    heading: 'Home',
    roles: ['staff'],
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
      { label: 'Equipment Catalog', to: '/catalog', icon: 'grid' }
    ]
  },
  {
    heading: 'Staff desk',
    roles: ['staff'],
    items: [
      { label: 'Approvals', to: '/staff/approvals', icon: 'check' },
      { label: 'Pending returns', to: '/staff/returns', icon: 'return' },
      { label: 'Overdue', to: '/staff/overdue', icon: 'clock' },
      { label: 'Damage reviews', to: '/admin/damage', icon: 'alert' },
      { label: 'Stock Count', to: '/staff/stock-count', icon: 'scan' },
      { label: 'Reports', to: '/admin/reports', icon: 'history' },
      { label: 'QR stickers', to: '/admin/qr-print', icon: 'scan' }
    ]
  },

  // ---------- Admin ----------
  {
    heading: 'Overview',
    roles: ['admin'],
    items: [
      { label: 'Admin Dashboard', to: '/admin', icon: 'shield' },
      { label: 'Reports', to: '/admin/reports', icon: 'history' }
    ]
  },
  {
    heading: 'Daily desk',
    roles: ['admin'],
    items: [
      { label: 'Approvals', to: '/staff/approvals', icon: 'check' },
      { label: 'Pending returns', to: '/staff/returns', icon: 'return' },
      { label: 'Overdue', to: '/staff/overdue', icon: 'clock' },
      { label: 'Damage reviews', to: '/admin/damage', icon: 'alert' }
    ]
  },
  {
    heading: 'Equipment',
    roles: ['admin'],
    items: [
      { label: 'Equipment Catalog', to: '/catalog', icon: 'grid' },
      { label: 'Equipment Types', to: '/admin/types', icon: 'grid' },
      { label: 'Equipment Units', to: '/admin/units', icon: 'grid' },
      { label: 'QR stickers', to: '/admin/qr-print', icon: 'scan' },
      { label: 'Maintenance', to: '/admin/maintenance', icon: 'key' },
      { label: 'Stock Count', to: '/staff/stock-count', icon: 'scan' },
      { label: 'Stock Audit', to: '/admin/stock-audit', icon: 'history' }
    ]
  },
  {
    heading: 'People and system',
    roles: ['admin'],
    items: [
      { label: 'Students and staff', to: '/admin/students', icon: 'shield' },
      { label: 'Settings', to: '/admin/settings', icon: 'key' },
      { label: 'Audit log', to: '/admin/audit-log', icon: 'history' }
    ]
  }
];

const ROLE_LABEL = {
  student: 'Student',
  staff: 'Sports staff',
  admin: 'Admin'
};

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
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
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

function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const user = readUser();
  const role = user.role || 'student';
  const forced = user.mustChangePassword === true;

  const crumb =
    NAV.flatMap((group) => group.items).find((item) => item.to === pathname)?.label ||
    (pathname === '/change-password' ? 'Change password' : '') ||
    (pathname === '/profile' ? 'My profile' : '');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
  };

  return (
    <div className="shell">
      {open && <div className="shell-scrim" onClick={() => setOpen(false)} />}

      <aside
        className={open ? 'shell-side shell-side-open' : 'shell-side'}
        aria-label="Main menu"
      >
        <div className="shell-brand">
          <div className="shell-brand-logos" aria-label="Vishwakarma University and Sports Council">
            <img src={universityLogo} alt="Vishwakarma University" />
            <img src={sportsCouncilLogo} alt="Vishwakarma University Sports Council" />
          </div>
          <span className="shell-brand-name">Sports Room</span>
        </div>

        <nav className="shell-nav">
          {NAV.filter((group) => !forced && group.roles.includes(role)).map((group) => (
            <div key={group.heading} className="shell-group">
              <p className="shell-heading">{group.heading}</p>
              {group.items.map((item) => (
                item.soon ? (
                  <span
                    key={item.label}
                    className="shell-item shell-item-soon"
                    aria-disabled="true"
                  >
                    <Icon name={item.icon} />
                    {item.label}
                    <small>Soon</small>
                  </span>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      isActive ? 'shell-item shell-item-on' : 'shell-item'
                    }
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                )
              ))}
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
            to="/profile"
            className={({ isActive }) =>
              isActive ? 'shell-item shell-item-on' : 'shell-item'
            }
            onClick={() => setOpen(false)}
          >
            <Icon name="user" />
            My profile
          </NavLink>

          <NavLink
            to="/change-password"
            className={({ isActive }) =>
              isActive ? 'shell-item shell-item-on' : 'shell-item'
            }
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

          <button
            type="button"
            className="shell-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>

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
