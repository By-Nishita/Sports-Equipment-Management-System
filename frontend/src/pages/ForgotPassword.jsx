import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

// Asks for the college email or SRN and emails a link to set a new password.
function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { identifier });      setMessage(res.data.message); // same text whether the account exists or not
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your college email or SRN. We will email you a link."
    >
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>College email or SRN</span>
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </label>
        {message && <p className="notice notice-ok" role="status">{message}</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button type="submit" className="btn-block" disabled={loading}>
          {loading ? 'Sending...' : 'Email me the link'}
        </button>
      </form>
      <p className="auth-sub">
        Email not coming? Show your ID card at the sports counter and staff will help.
      </p>
      <p className="auth-sub"><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}

export default ForgotPassword;
