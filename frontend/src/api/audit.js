import api from './axios';

// Admin only. params: { page, limit, action }
export const getAuditLogs = (params) => api.get('/audit-logs', { params });
