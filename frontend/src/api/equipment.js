import api from './axios';

export const getEquipment = () => api.get('/equipment');
export const createEquipment = (data) => api.post('/equipment', data);