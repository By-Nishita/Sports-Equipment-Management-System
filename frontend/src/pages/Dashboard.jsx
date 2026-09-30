import { useEffect, useState } from 'react';
import api from '../api/axios';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load equipment
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const response = await api.get('/equipment');
        setEquipment(response.data.equipment || []);
      } catch (err) {
        setError(
          err.response?.data?.message || 'Failed to load equipment'
        );
      }
    };

    fetchEquipment();
  }, []);

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

      // Clear form
      setSelectedEquipment('');
      setStartTime('');
      setEndTime('');

    } catch (err) {
      setError(
        err.response?.data?.message || 'Booking failed'
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
        <div>
          {equipment.map((item) => (
            <div
              key={item._id}
              style={{
                border: '1px solid #ccc',
                padding: '15px',
                marginBottom: '15px',
                maxWidth: '400px'
              }}
            >
              <h3>{item.name}</h3>

              <p>Category: {item.category}</p>

              <p>
                Available: {
                  item.availableQuantity ?? 'N/A'
                }
              </p>

              <p>
                Status: {item.status}
              </p>
            </div>
          ))}
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
          {loading ? 'Booking...' : 'Book Equipment'}
        </button>

      </form>

    </div>
  );
}

export default Dashboard;