import { useCallback, useEffect, useState } from "react";
import { getMyReservations, cancelReservation } from "../api/reservations";

const card = { border: "1px solid #ddd", borderRadius: 10, padding: 16, marginBottom: 12 };

export default function MyBookings() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      setError("");
      const data = await getMyReservations();
      setReservations(Array.isArray(data) ? data : data.reservations || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      setBusyId(id);
      await cancelReservation(id);
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel booking.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 850 }}>
      <h1>My Bookings</h1>
      <p>View your reservations and their current status.</p>

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading bookings...</p>}

      {!loading && reservations.length === 0 && (
        <div style={card}>
          <p>You haven't made any bookings yet.</p>
        </div>
      )}

      {reservations.map((booking) => {
        const item = booking.equipment || {};
        return (
          <article key={booking._id} style={card}>
            <h3>{item.name || "Equipment"}</h3>
            <p><strong>Equipment ID:</strong> {item.equipmentId || "—"}</p>
            <p><strong>Start:</strong> {booking.startTime ? new Date(booking.startTime).toLocaleString() : "—"}</p>
            <p><strong>End:</strong> {booking.endTime ? new Date(booking.endTime).toLocaleString() : "—"}</p>
            <p><strong>Status:</strong> {booking.status}</p>

            {booking.status === "ACTIVE" && (
              <button disabled={busyId === booking._id} onClick={() => handleCancel(booking._id)}>
                {busyId === booking._id ? "Cancelling..." : "Cancel Booking"}
              </button>
            )}
          </article>
        );
      })}

      <button onClick={loadBookings}>Refresh Bookings</button>
    </div>
  );
}
