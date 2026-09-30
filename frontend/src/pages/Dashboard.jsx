import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { getEquipment, createEquipment } from '../api/equipment';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState([]);

  // Admin/staff add equipment
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    equipmentId: '',
    name: '',
    category: ''
  });

  // Booking
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'staff';

  // Load equipment
  const loadEquipment = async () => {
    try {
      const response = await getEquipment();
      setEquipment(response.data.equipment || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to load equipment'
      );
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

  // Add equipment - admin/staff
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

      loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to add equipment'
      );
    }
  };

  // Book equipment
  const handleBooking = async (e) => {
    e.preventDefault();

    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/reservations', {
        equipmentId: selectedEquipment,
        startTime,
        endTime
      });

      setMessage(response.data.message);

      setSelectedEquipment('');
      setStartTime('');
      setEndTime('');

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Booking failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px' }}>

      {/* USER INFORMATION */}
      <h2>Welcome, {user?.name}!</h2>

      <p>Role: {user?.role}</p>
      <p>Email: {user?.email}</p>

      <hr />

      {/* NAVIGATION */}
      <button onClick={handleLogout}>
        Logout
      </button>

      <button
        onClick={() => navigate('/scan')}
        style={{ marginLeft: '10px' }}
      >
        Scan QR (Issue / Return)
      </button>

      <button
        onClick={() => navigate('/reservations')}
        style={{ marginLeft: '10px' }}
      >
        My Reservations
      </button>

      <hr />

      {/* EQUIPMENT SECTION */}
      <h2>Sports Equipment</h2>

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {message && (
        <p style={{ color: 'green' }}>
          {message}
        </p>
      )}

      {equipment.length === 0 ? (
        <p>No equipment available.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '15px'
          }}
        >
          {equipment.map((item) => (
            <div
              key={item._id}
              style={{
                border: '1px solid #ccc',
                padding: '15px',
                borderRadius: '8px'
              }}
            >
              <h3>{item.name}</h3>

              <p>
                ID: {item.equipmentId}
              </p>

              <p>
                Category: {item.category}
              </p>

              <p>
                Available: {
                  item.availableQuantity ?? 'N/A'
                }
              </p>

              <p>
                Status: {item.status}
              </p>

              {/* Admin/staff can see QR */}
              {isAdmin && item.qrIdentifier && (
                <img
                  src={item.qrIdentifier}
                  alt="QR"
                  style={{ width: '80px' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <hr />

      {/* ADMIN / STAFF ADD EQUIPMENT */}
      {isAdmin && (
        <div style={{ margin: '20px 0' }}>

          <button
            onClick={() => setShowForm(!showForm)}
          >
            {showForm
              ? 'Cancel'
              : '+ Add Equipment'}
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

      <hr />

      {/* BOOKING FORM */}
      <h2>Book Equipment</h2>

      <form onSubmit={handleBooking}>

        <div>
          <label>Equipment: </label>

          <select
            value={selectedEquipment}
            onChange={(e) =>
              setSelectedEquipment(e.target.value)
            }
            required
          >
            <option value="">
              Select Equipment
            </option>

            {equipment.map((item) => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <br />

        <div>
          <label>Start Time: </label>

          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) =>
              setStartTime(e.target.value)
            }
            required
          />
        </div>

        <br />

        <div>
          <label>End Time: </label>

          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) =>
              setEndTime(e.target.value)
            }
            required
          />
        </div>

        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? 'Booking...'
            : 'Book Equipment'}
        </button>

      </form>

    </div>
  );
}

export default Dashboard;