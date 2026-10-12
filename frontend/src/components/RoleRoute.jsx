import { Navigate } from 'react-router-dom';

// Sirf diye gaye roles ko page dikhata hai, baaki ko dashboard bhej deta hai.
// Ye sirf screen ka rasta hai; asli rok backend ka authorize() hai.
function RoleRoute({ roles, children }) {
  let role = 'student';
  try {
    role = JSON.parse(localStorage.getItem('user'))?.role || 'student';
  } catch {
    /* localStorage kharab ho to student maan lo */
  }

  return roles.includes(role) ? children : <Navigate to="/dashboard" replace />;
}

export default RoleRoute;
