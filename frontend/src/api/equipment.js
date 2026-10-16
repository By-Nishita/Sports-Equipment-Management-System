import api from './axios';

export const getEquipment = (params = {}) => api.get('/equipment', { params });
export const createEquipment = (data) => api.post('/equipment', data);
export const updateEquipment = (id, data) => api.patch('/equipment/' + id, data);
export const deactivateEquipment = (id) => api.patch('/equipment/' + id + '/deactivate');

export const reactivateEquipment = (id) => api.patch('/equipment/' + id + '/reactivate');
