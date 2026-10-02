import axios from "./axios";

export const createReservation = async (equipmentId) => {
  const response = await axios.post("/reservations", {
    equipmentId
  });

  return response.data;
};

export const getMyReservations = async () => {
  const response = await axios.get("/reservations/mine");

  return response.data;
};

export const cancelReservation = async (reservationId) => {
  const response = await axios.post(
    `/reservations/${reservationId}/cancel`
  );

  return response.data;
};