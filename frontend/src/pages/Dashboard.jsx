function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div>
      <h2>Welcome, {user?.name}!</h2>
      <p>Role: {user?.role}</p>
      <p>Email: {user?.email}</p>
    </div>
  );
}

export default Dashboard;