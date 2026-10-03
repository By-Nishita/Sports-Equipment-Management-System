import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await api.post(
        '/auth/change-password',
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // localStorage mein user data bhi update karo
      const user = JSON.parse(localStorage.getItem('user'));
      user.mustChangePassword = false;
      localStorage.setItem('user', JSON.stringify(user));

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a password of at least 6 characters to continue.">
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
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
    </AuthLayout>
  );
}

export default ChangePassword;
