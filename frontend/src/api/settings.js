import api from './axios';

// Staff/admin can read, only admin can save
export const getSettings = () => api.get('/settings');
export const saveSettings = (values) => api.put('/settings', values);