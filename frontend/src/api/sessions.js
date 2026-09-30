import api from './axios';

export const issueEquipment = (equipmentId) =>
  api.post('/sessions/issue', { equipmentId });

export const returnEquipment = (equipmentId, condition) =>
  api.post('/sessions/return', { equipmentId, condition });