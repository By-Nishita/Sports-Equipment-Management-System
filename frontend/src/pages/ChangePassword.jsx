import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Show a different sentence when the user is forced to change (first login)
  let forced = false;
  try {
    forced = JSON.parse(localStorage.getItem('user'))?.mustChangePassword === true;
  } catch {
    /* ignore */
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', { oldPassword, newPassword });

      // The backend sends a NEW token (the old one stops working after a password change).
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="page-head">
        <p className="page-eyebrow">Account</p>
        <h1>Change password</h1>
        <p className="page-sub">
          {forced
            ? 'For your safety, please set a new password before you continue.'
            : 'Choose a new password for your account.'}{' '}
          It must be at least 8 characters and not your SRN or email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <label className="field">
          <span>{forced ? 'Current (given) password' : 'Current password'}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-block" disabled={loading}>
          {loading ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;
