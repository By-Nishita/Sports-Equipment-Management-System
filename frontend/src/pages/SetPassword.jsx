import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

// The page the emailed link opens:  /set-password?token=....
function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/set-password', { token, newPassword });
      setDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Set your password">
        <p className="notice notice-error" role="alert">This link is not complete. Please request a new one.</p>
        <p className="auth-sub"><Link to="/forgot-password">Get a new link</Link></p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="All done">
        <p className="notice notice-ok" role="status">{done}</p>
        <p className="auth-sub"><Link to="/login">Go to sign in</Link></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" subtitle="At least 8 characters, and not your SRN or email.">
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input type="password" autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button type="submit" className="btn-block" disabled={loading}>
          {loading ? 'Saving...' : 'Save password'}
        </button>
      </form>
      {error && <p className="auth-sub"><Link to="/forgot-password">Get a new link</Link></p>}
    </AuthLayout>
  );
}

export default SetPassword;
