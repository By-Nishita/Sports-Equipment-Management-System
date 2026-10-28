import api from './axios';

// Every reply looks like { success, message, data, pagination? }, so the useful part is res.data.data.

// Anyone logged in: report a problem with the unit printed on the item (e.g. FB-007).
// type is DAMAGE or LOSS.
export const createDamageReport = ({ unitCode, description, type }) =>
  api.post('/damage-reports', { unitCode, description, type });

// Logged-in user's own reports, newest first
export const getMyDamageReports = (params = {}) => api.get('/damage-reports/my', { params });

// Staff/admin: all reports. params: { status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED', page }
export const getDamageReports = (params = {}) => api.get('/damage-reports', { params });

// Staff/admin: "I have checked it" (PENDING -> UNDER_REVIEW)
export const verifyDamageReport = (id, note) => api.patch(`/damage-reports/${id}/verify`, { note });

// Admin only: the final decision. resolution = REPAIRED | RETIRED | LOST
export const resolveDamageReport = (id, { resolution, note }) =>
  api.patch(`/damage-reports/${id}/resolve`, { resolution, note });
