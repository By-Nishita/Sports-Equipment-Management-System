import api from './axios';

// Staff/admin: the numbers shown on the Admin Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');