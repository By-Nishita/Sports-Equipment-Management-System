import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEquipment,
  createEquipment,
  updateEquipment,
  deactivateEquipment,
  reactivateEquipment
} from '../api/equipment';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    equipmentId: '',
    name: '',
    category: ''
  });

  const isAdmin =
    user?.role === 'admin' || user?.role === 'staff';

  // Load equipment
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

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Add equipment
  const handleAdd = async (e) => {
    e.preventDefault();

    try {
      await createEquipment(form);

      setForm({
        equipmentId: '',
        name: '',
        category: ''
      });

      setShowForm(false);
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to add equipment'
      );
    }
  };

  // Edit equipment
  const handleEditEquipment = async (item) => {
    const name = window.prompt('Equipment name:', item.name);
    if (name === null) return;

    const category = window.prompt('Category:', item.category);
    if (category === null) return;

    const location = window.prompt('Location:', item.location || '');
    if (location === null) return;

    try {
      await updateEquipment(item._id, {
        name,
        category,
        location
      });

      alert('Equipment updated successfully');
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to update equipment'
      );
    }
  };

  // Deactivate equipment
  const handleDeactivateEquipment = async (item) => {
    if (!window.confirm('Deactivate ' + item.name + '?')) return;

    try {
      await deactivateEquipment(item._id);
      alert('Equipment deactivated');
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to deactivate equipment'
      );
    }
  };

  // Reactivate retired equipment
  const handleReactivateEquipment = async (item) => {
    if (!window.confirm('Reactivate ' + item.name + '?')) return;

    try {
      await reactivateEquipment(item._id);
      alert('Equipment reactivated successfully');
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to reactivate equipment'
      );
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Welcome, {user?.name}!</h2>

      <p>Role: {user?.role}</p>

      {/* Logout */}
      <button onClick={handleLogout}>
        Logout
      </button>

      {/* Scan QR */}
      <button
        onClick={() => navigate('/scan')}
        style={{ marginLeft: '10px' }}
      >
        Scan QR (Issue / Return)
      </button>

      {/* Report Damage */}
      <button
        onClick={() => navigate('/report-damage')}
        style={{ marginLeft: '10px' }}
      >
        Report Damage
      </button>

      {/* Staff/Admin Damage Reviews */}
      {isAdmin && (
        <button
          onClick={() => navigate('/admin/damage')}
          style={{ marginLeft: '10px' }}
        >
          Admin: Damage Reviews
        </button>
      )}

      {/* Admin / Staff Add Equipment */}
      {isAdmin && (
        <div style={{ margin: '20px 0' }}>
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Equipment'}
          </button>

          {showForm && (
            <form
              onSubmit={handleAdd}
              style={{ marginTop: '10px' }}
            >
              <input
                placeholder="Equipment ID (e.g. FB-001)"
                value={form.equipmentId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    equipmentId: e.target.value
                  })
                }
                required
              />

              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
                required
              />

              <input
                placeholder="Category"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value
                  })
                }
                required
              />

              <button type="submit">
                Save
              </button>
            </form>
          )}
        </div>
      )}

      {/* Equipment List */}
      <h3>Equipment List</h3>

      {/* Search and filters */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '15px',
          flexWrap: 'wrap'
        }}
      >
        <input
          type="text"
          aria-label="Search equipment"
          placeholder="Search name, category, brand, location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          aria-label="Category filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {[
            ...new Set(
              equipment
                .map((item) => item.category)
                .filter(Boolean)
            )
          ].map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            'AVAILABLE',
            'IN_USE',
            'DAMAGED',
            'MAINTENANCE',
            'LOST',
            'RETIRED'
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setSearchTerm('');
            setCategoryFilter('');
            setStatusFilter('');
          }}
        >
          Clear filters
        </button>
      </div>

      {/* Equipment cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px'
        }}
      >
        {equipment
          .filter(
            (item) =>
              (!categoryFilter || item.category === categoryFilter) &&
              (!statusFilter || item.status === statusFilter) &&
              (
                !searchTerm ||
                [
                  item.name,
                  item.category,
                  item.brand,
                  item.location
                ].some((value) =>
                  String(value || '')
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
                )
              )
          )
          .map((item) => (
            <div
              key={item._id}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                borderRadius: '8px'
              }}
            >
              <p>
                <strong>{item.name}</strong>
              </p>

              <p>ID: {item.equipmentId}</p>
              <p>Category: {item.category}</p>
              <p>Status: {item.status}</p>

              {/* Admin / Staff equipment management */}
              {isAdmin && (
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    margin: '8px 0',
                    flexWrap: 'wrap'
                  }}
                >
                  {item.status === 'RETIRED' ? (
                    <button
                      onClick={() => handleReactivateEquipment(item)}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditEquipment(item)}
                      >
                        Edit Equipment
                      </button>

                      <button
                        onClick={() => handleDeactivateEquipment(item)}
                      >
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Admin / Staff QR download */}
              {isAdmin && item.qrIdentifier && (
                <div style={{ margin: '8px 0' }}>
                  <img
                    src={item.qrIdentifier}
                    alt="Equipment QR code"
                    style={{ width: '80px' }}
                  />

                  <br />

                  <a
                    href={item.qrIdentifier}
                    download={
                      (item.equipmentId || item.name || 'equipment') +
                      '-QR.png'
                    }
                  >
                    <button type="button">
                      Download QR
                    </button>
                  </a>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

export default Dashboard;