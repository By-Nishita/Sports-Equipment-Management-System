import api from './axios';

// Admin only
export const getUsers = (params) => api.get('/users', { params });
export const issueTempPassword = (id) => api.post(`/users/${id}/temp-password`);
