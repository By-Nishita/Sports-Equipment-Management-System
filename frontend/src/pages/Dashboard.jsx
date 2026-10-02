import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEquipment, createEquipment } from '../api/equipment';
import {
  createReservation,
  getMyReservations,
  cancelReservation
} from '../api/reservations';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [showForm, setShowForm] = useState(false);

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

  // Load current user's reservations
  const loadReservations = async () => {
    try {
      const res = await getMyReservations();
      setReservations(res);
    } catch (err) {
      console.error('Failed to load reservations:', err);
    }
  };

  useEffect(() => {
    loadEquipment();
    loadReservations();
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

      loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to add equipment'
      );
    }
  };

  // Reserve equipment
  const handleReserve = async (equipmentId) => {
    try {
      await createReservation(equipmentId);

      alert('Equipment reserved successfully');

      await loadReservations();
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to reserve equipment'
      );
    }
  };

  // Cancel reservation
  const handleCancelReservation = async (reservationId) => {
    try {
      await cancelReservation(reservationId);

      alert('Reservation cancelled successfully');

      await loadReservations();
      await loadEquipment();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        'Failed to cancel reservation'
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


      {/* Admin / Staff Add Equipment */}
      {isAdmin && (
        <div style={{ margin: '20px 0' }}>

          <button
            onClick={() => setShowForm(!showForm)}
          >
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px'
        }}
      >

        {equipment.map((item) => {

          const myReservation = reservations.find(
            (reservation) =>
              reservation.equipment?._id === item._id &&
              reservation.status === 'ACTIVE'
          );

          return (
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

              <p>
                ID: {item.equipmentId}
              </p>

              <p>
                Category: {item.category}
              </p>

              <p>
                Status: {item.status}
              </p>


              {/* Reservation Status */}

              {item.reservedByMe && (
                <>
                  <p>
                    <strong>
                      Reserved by you
                    </strong>
                  </p>

                  {item.reservedUntil && (
                    <p>
                      Until:{' '}
                      {new Date(
                        item.reservedUntil
                      ).toLocaleTimeString()}
                    </p>
                  )}

                  {myReservation && (
                    <button
                      onClick={() =>
                        handleCancelReservation(
                          myReservation._id
                        )
                      }
                    >
                      Cancel Reservation
                    </button>
                  )}
                </>
              )}


              {/* Reserved by someone else */}

              {item.isReserved &&
                !item.reservedByMe && (
                  <p>
                    <strong>
                      Reserved
                    </strong>
                  </p>
                )}


              {/* Reserve Button */}

              {item.status === 'AVAILABLE' &&
                !item.isReserved && (
                  <button
                    onClick={() =>
                      handleReserve(
                        item.equipmentId
                      )
                    }
                  >
                    Reserve
                  </button>
                )}


              {/* Admin / Staff QR */}

              {isAdmin &&
                item.qrIdentifier && (
                  <img
                    src={item.qrIdentifier}
                    alt="QR"
                    style={{
                      width: '80px'
                    }}
                  />
                )}

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default Dashboard;