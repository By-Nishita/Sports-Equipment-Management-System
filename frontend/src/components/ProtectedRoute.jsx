// frontend/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';

// Wraps a page and only renders it if a token exists in localStorage.
// Agar token nahi hai, seedha /login pe bhej deta hai.
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const { pathname } = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Must change password first? Then the only page they may see is the change-password page.
  let mustChange = false;
  try {
    mustChange = JSON.parse(localStorage.getItem('user'))?.mustChangePassword === true;
  } catch {
    /* ignore */
  }
  if (mustChange && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

export default ProtectedRoute;
