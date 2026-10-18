import api from './axios';

export const issueEquipment = (equipmentId) =>
  api.post('/sessions/issue', { equipmentId });

export const returnEquipment = (equipmentId, condition) =>
  api.post('/sessions/return', { equipmentId, condition });

// Logged-in user ke apne sessions (naye pehle)
export const getMySessions = () => api.get('/sessions/my');
// Staff/admin: all sessions that are checked out right now (late ones are included, marked by isOverdue)
export const getActiveSessions = () => api.get('/sessions/active');
