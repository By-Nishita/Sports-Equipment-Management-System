import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getEquipment } from "../api/equipment";
import { createReservation } from "../api/reservations";

const box = { padding: 16, border: "1px solid #ddd", borderRadius: 10, marginBottom: 14 };
const input = { display: "block", width: "100%", maxWidth: 420, padding: 10, margin: "8px 0 16px", boxSizing: "border-box" };

export default function Booking() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const now = new Date();
  const localValue = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const minDate = localValue(now);
  const maxDate = localValue(new Date(now.getTime() + 7 * 86400000));

  useEffect(() => {
    getEquipment()
      .then((res) => setEquipment(res.data.equipment || []))
      .catch(() => setError("Could not load equipment. Please refresh."));
  }, []);

  const handleStart = (value) => {
    setStartTime(value);
    if (value) {
      const suggestedEnd = new Date(new Date(value).getTime() + 60 * 60000);
      setEndTime(localValue(suggestedEnd));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!equipmentId || !startTime || !endTime) {
      setError("Please fill in all fields.");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = (end - start) / 60000;

    if (start <= new Date()) {
      setError("Please select a future start time.");
      return;
    }
    if (duration < 30 || duration > 120) {
      setError("Booking duration must be between 30 minutes and 2 hours.");
      return;
    }
    if (start > new Date(Date.now() + 7 * 86400000)) {
      setError("Bookings can only be made up to 7 days in advance.");
      return;
    }

    try {
      setLoading(true);
      await createReservation({
        equipmentId,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });
      setSuccess("Booking created successfully!");
      setEquipmentId("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      setError(err.response?.data?.message || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1>Book Equipment</h1>
      <p>Choose equipment and reserve a time slot.</p>
      <div style={box}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="equipment">Equipment</label>
          <select id="equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required style={input}>
            <option value="">Select equipment</option>
            {equipment.filter((item) => item.status === "AVAILABLE" || item.status === "IN_USE").map((item) => (
              <option key={item._id} value={item.equipmentId}>
                {item.name} ({item.equipmentId}) — {item.status}
              </option>
            ))}
          </select>

          <label htmlFor="start">Start date and time</label>
          <input id="start" type="datetime-local" min={minDate} max={maxDate} value={startTime} onChange={(e) => handleStart(e.target.value)} required style={input} />

          <label htmlFor="end">End date and time</label>
          <input id="end" type="datetime-local" min={startTime || minDate} max={maxDate} value={endTime} onChange={(e) => setEndTime(e.target.value)} required style={input} />

          <p>Duration: 30 minutes to 2 hours. Book up to 7 days ahead.</p>
          {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
          {success && <p role="status" style={{ color: "green" }}>{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Booking..." : "Confirm Booking"}
          </button>
        </form>
      </div>
      <button onClick={() => navigate("/my-bookings")}>View My Bookings</button>
    </div>
  );
}
