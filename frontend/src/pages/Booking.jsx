import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEquipment } from '../api/equipment';
import { createReservation } from '../api/reservations';

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getDefaultStart() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(0);
  date.setHours(date.getHours() + 1);
  return toLocalDateTimeValue(date);
}

function getDefaultEnd(startValue) {
  const start = new Date(startValue);
  start.setMinutes(start.getMinutes() + 60);
  return toLocalDateTimeValue(start);
}

export default function Booking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [equipment, setEquipment] = useState([]);
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipment') || ''
  );
  const [startTime, setStartTime] = useState(getDefaultStart);
  const [endTime, setEndTime] = useState(() => getDefaultEnd(getDefaultStart()));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const now = new Date();
  const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    async function loadEquipment() {
      try {
        setError('');
        const response = await getEquipment();
        const items = response.data?.equipment || [];

        setEquipment(items);

        const requestedId = searchParams.get('equipment');
        const requestedItem = items.find(
          (item) => item.equipmentId === requestedId
        );

        if (requestedItem && requestedItem.status === 'AVAILABLE') {
          setEquipmentId(requestedId);
        } else {
          const firstAvailable = items.find(
            (item) => item.status === 'AVAILABLE'
          );
          if (!requestedId && firstAvailable) {
            setEquipmentId(firstAvailable.equipmentId);
          }
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Could not load equipment. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadEquipment();
  }, [searchParams]);

  const handleStartChange = (value) => {
    setStartTime(value);

    if (value) {
      const suggestedEnd = getDefaultEnd(value);
      setEndTime(suggestedEnd);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!equipmentId) {
      setError('Please select available equipment.');
      return;
    }

    if (!startTime || !endTime) {
      setError('Please select both start and end times.');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const currentTime = new Date();
    const latestStart = new Date(
      currentTime.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Please enter valid start and end times.');
      return;
    }

    if (start.getTime() < currentTime.getTime() - 60000) {
      setError('Start time cannot be in the past.');
      return;
    }

    if (start > latestStart) {
      setError('Bookings can only be made up to 7 days in advance.');
      return;
    }

    const durationMinutes = (end.getTime() - start.getTime()) / 60000;

    if (durationMinutes < 30 || durationMinutes > 120) {
      setError('Your booking must be between 30 minutes and 2 hours.');
      return;
    }

    try {
      setSubmitting(true);

      await createReservation({
        equipmentId,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });

      setSuccess('Booking created successfully!');

      setTimeout(() => {
        navigate('/my-bookings');
      }, 800);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Booking failed. Please check the selected slot and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const availableEquipment = equipment.filter(
    (item) => item.status === 'AVAILABLE'
  );

  if (loading) {
    return <div style={{ padding: 24 }}>Loading equipment...</div>;
  }

  return (
    <main style={{
      maxWidth: 650,
      margin: '30px auto',
      padding: 24,
      fontFamily: 'Arial, sans-serif'
    }}>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: 20 }}
      >
        ? Back to Dashboard
      </button>

      <h1>Book Equipment</h1>
      <p>Select equipment and reserve a time slot.</p>

      {error && (
        <div role="alert" style={{
          color: '#b91c1c',
          background: '#fee2e2',
          padding: 12,
          borderRadius: 6,
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {success && (
        <div role="status" style={{
          color: '#166534',
          background: '#dcfce7',
          padding: 12,
          borderRadius: 6,
          marginBottom: 16
        }}>
          {success}
        </div>
      )}

      {availableEquipment.length === 0 ? (
        <section style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 20
        }}>
          <p>No equipment is currently marked as available.</p>
          <button type="button" onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </button>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid #ddd',
            borderRadius: 10,
            padding: 22,
            display: 'grid',
            gap: 18
          }}
        >
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Select Equipment</strong>
            <select
              value={equipmentId}
              onChange={(event) => setEquipmentId(event.target.value)}
              required
              style={{ padding: 10 }}
            >
              <option value="">Choose equipment</option>
              {availableEquipment.map((item) => (
                <option key={item.equipmentId} value={item.equipmentId}>
                  {item.name} ({item.equipmentId})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Start Time</strong>
            <input
              type="datetime-local"
              value={startTime}
              min={toLocalDateTimeValue(new Date(Date.now() - 60000))}
              max={toLocalDateTimeValue(maxDate)}
              onChange={(event) => handleStartChange(event.target.value)}
              required
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <strong>End Time</strong>
            <input
              type="datetime-local"
              value={endTime}
              min={startTime || undefined}
              max={startTime
                ? toLocalDateTimeValue(
                    new Date(new Date(startTime).getTime() + 120 * 60000)
                  )
                : undefined}
              onChange={(event) => setEndTime(event.target.value)}
              required
              style={{ padding: 10 }}
            />
          </label>

          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
            Booking duration must be at least 30 minutes and no more than
            2 hours. Reservations can be made up to 7 days in advance.
          </p>

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: 12,
              cursor: submitting ? 'wait' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      )}
    </main>
  );
}
