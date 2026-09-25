import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEquipment, createEquipment } from '../api/equipment';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', name: '', category: '' });

  const isAdmin = user?.role === 'admin' || user?.role === 'staff';

  const loadEquipment = async () => {
    try {
      const res = await getEquipment();
      setEquipment(res.data.equipment);
    } catch (err) {
      console.error('Failed to load equipment:', err);
    }
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await createEquipment(form);
      setForm({ equipmentId: '', name: '', category: '' });
      setShowForm(false);
      loadEquipment(); // list refresh karo
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add equipment');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Welcome, {user?.name}!</h2>
      <p>Role: {user?.role}</p>
      <button onClick={handleLogout}>Logout</button>

      {/* Sirf admin/staff ko ye button dikhega */}
      {isAdmin && (
        <div style={{ margin: '20px 0' }}>
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Equipment'}
          </button>

          {showForm && (
            <form onSubmit={handleAdd} style={{ marginTop: '10px' }}>
              <input
                placeholder="Equipment ID (e.g. FB-001)"
                value={form.equipmentId}
                onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
                required
              />
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              />
              <button type="submit">Save</button>
            </form>
          )}
        </div>
      )}

      {/* Ye list dono (student aur admin) ko same dikhegi */}
      <h3>Equipment List</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {equipment.map((item) => (
          <div key={item._id} style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '8px' }}>
            <p><strong>{item.name}</strong></p>
            <p>ID: {item.equipmentId}</p>
            <p>Category: {item.category}</p>
            <p>Status: {item.status}</p>
            {isAdmin && item.qrIdentifier && (
              <img src={item.qrIdentifier} alt="QR" style={{ width: '80px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;