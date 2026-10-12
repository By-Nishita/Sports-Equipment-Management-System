import api from './axios';

// Naya damage/loss report bhejo
export const createDamageReport = ({ equipmentId, description, type }) =>
  api.post('/damage-reports', { equipmentId, description, type });

// Logged-in user ki apni reports (naye pehle)
export const getMyDamageReports = () => api.get('/damage-reports/mine');

// Staff/admin: saari reports. status dena ho to sirf us halat ki (PENDING, UNDER_REVIEW, RESOLVED)
export const getDamageReports = (status) =>
  api.get('/damage-reports', { params: status ? { status } : {} });

// Staff/admin: report review karo. body = { status, resolution?, staffNote? }
export const reviewDamageReport = (id, body) => api.patch(`/damage-reports/${id}/review`, body);
