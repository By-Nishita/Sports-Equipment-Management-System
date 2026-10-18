import api from './axios';

export const issueEquipment = (equipmentId) =>
  api.post('/sessions/issue', { equipmentId });

// description is optional: only sent for DAMAGED returns (goes into the auto damage report)
export const returnEquipment = (equipmentId, condition, description) =>
  api.post('/sessions/return', { equipmentId, condition, description });

// Logged-in user's own sessions (newest first)
export const getMySessions = () => api.get('/sessions/my');

// Staff/admin: sessions that are currently issued (used by the Admin Dashboard)
export const getActiveSessions = () => api.get('/sessions/active');
