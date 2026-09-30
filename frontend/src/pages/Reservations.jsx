import { useEffect, useState } from 'react';
import api from '../api/axios';
import './Reservations.css';

function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const response = await api.get('/reservations/my');

        setReservations(response.data.reservations || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Failed to load reservations'
        );
      }
    };

    fetchReservations();
  }, []);

  return (
    <div className="reservations-page">

      <h2>My Reservations</h2>

      {error && (
        <p className="reservation-error">
          {error}
        </p>
      )}

      {reservations.length === 0 ? (
        <p className="no-reservations">
          No reservations yet.
        </p>
      ) : (
        <div className="reservations-list">

          {reservations.map((reservation) => (
            <div
              className="reservation-card"
              key={reservation._id}
            >

              <h3>
                {reservation.equipment?.name}
              </h3>

              <p>
                <strong>Start:</strong>{' '}
                {new Date(
                  reservation.startTime
                ).toLocaleString()}
              </p>

              <p>
                <strong>End:</strong>{' '}
                {new Date(
                  reservation.endTime
                ).toLocaleString()}
              </p>

              <p>
                <strong>Status:</strong>{' '}
                <span className="reservation-status">
                  {reservation.status}
                </span>
              </p>

            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default Reservations;