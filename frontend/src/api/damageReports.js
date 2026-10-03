import api from './axios';

// Naya damage/loss report bhejo
export const createDamageReport = ({ equipmentId, description, type }) =>
  api.post('/damage-reports', { equipmentId, description, type });

// Logged-in user ki apni reports (naye pehle)
export const getMyDamageReports = () => api.get('/damage-reports/mine');
