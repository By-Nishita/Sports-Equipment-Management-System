import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div>
      <h2>Welcome, {user?.name}!</h2>
      <p>Role: {user?.role}</p>
      <p>Email: {user?.email}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Dashboard;
