// Login aur ChangePassword dono ka common dhaancha: left mein brand, right mein form.
// Ek jagah likha hai taaki dono pages same dikhein.
import { useState } from 'react';
import universityLogo from '../assets/vishwakarma-university.png';
import sportsCouncilLogo from '../assets/vishwakarma-sports-council.png';
import '../pages/Login.css';

function CourtLines() {
  // Basketball court ki half-court lines, sirf sajaavat (screen reader ko chhupa hua)
  return (
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3">
        <rect x="30" y="30" width="340" height="540" />
        <rect x="130" y="30" width="140" height="190" />
        <circle cx="200" cy="220" r="70" />
        <path d="M60 30 V150 A140 140 0 0 0 340 150 V30" />
        <line x1="30" y1="570" x2="370" y2="570" />
        <circle cx="200" cy="570" r="50" />
      </g>
    </svg>
  );
}

function AuthLayout({ title, subtitle, children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
  };

  return (
    <div className="auth">
      <aside className="auth-brand">
        <CourtLines />
        <div className="auth-logos" aria-label="Vishwakarma University and Sports Council">
          <img src={universityLogo} alt="Vishwakarma University" />
          <img src={sportsCouncilLogo} alt="Vishwakarma University Sports Council" />
        </div>
        <h1>Sports Room</h1>
        <p>Issue, return and track every piece of equipment.</p>
      </aside>
      <main className="auth-panel">
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <div className="auth-form">
          <h2>{title}</h2>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
