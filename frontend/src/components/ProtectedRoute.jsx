// frontend/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';

// Wraps a page and only renders it if a token exists in localStorage.
// Agar token nahi hai, seedha /login pe bhej deta hai.
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
