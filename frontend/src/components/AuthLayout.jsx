import { useState } from 'react';
import universityLogo from '../assets/vishwakarma-university.png';
import sportsCouncilLogo from '../assets/vishwakarma-sports-council.png';
import '../pages/Login.css';

function AuthLayout({ title, subtitle, children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  );

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
        <div className="auth-brand-content">
          <div className="auth-logos" aria-label="Vishwakarma University and Sports Council">
            <img src={universityLogo} alt="Vishwakarma University" />
            <img src={sportsCouncilLogo} alt="Vishwakarma University Sports Council" />
          </div>
          <span className="auth-eyebrow">SPORTS EQUIPMENT MANAGEMENT</span>

          <h1>
            Your Game.
            <br />
            Your Equipment.
          </h1>

          <p>
            Issue, return and track every piece of equipment.
            Everything your sports room needs, in one place.
          </p>

          <div className="auth-sports-gallery">
            <img
              src="/images/sports-lowpoly.png"
              alt="Sports illustration"
              className="auth-sports-image auth-sports-image-main"
            />

            <img
              src="/images/sports-vector.png"
              alt="Collection of sports illustrations"
              className="auth-sports-image auth-sports-image-secondary"
            />
          </div>

          <div className="auth-brand-footer">
            <span className="auth-status-dot"></span>
            <span>Made for every athlete</span>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span aria-hidden="true">
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <div className="auth-form">
          <div className="auth-form-heading">
            <span className="auth-form-label">WELCOME BACK</span>
            <h2>{title}</h2>
            {subtitle && <p className="auth-sub">{subtitle}</p>}
          </div>

          {children}
        </div>

        <p className="auth-panel-footer">
          Sports Room <span aria-hidden="true">·</span> Equipment Management
        </p>
      </main>
    </div>
  );
}

export default AuthLayout;
