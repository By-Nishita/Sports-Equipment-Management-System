import api from './axios';

// The issue/return flow. Every reply looks like { success, message, data, pagination? },
// so the useful part is always res.data.data.

// ---- Student ----
// 1. Ask for an item (no specific unit yet). acknowledged must be true.
export const requestIssue = (typeId, acknowledged) =>
  api.post('/sessions/request-issue', { typeId, acknowledged });

// Student changes their mind while the request is still waiting
export const cancelRequest = (id) => api.post(`/sessions/${id}/cancel`);

// 3. Ask to return. The late clock stops at this moment.
export const requestReturn = ({ sessionId, conditionClaimed, note }) =>
  api.post('/sessions/request-return', { sessionId, conditionClaimed, note });

// Own sessions, newest first. params: { open: 'true' } = only the unfinished ones, { page, limit }
export const getMySessions = (params = {}) => api.get('/sessions/my', { params });

// ---- Staff / admin ----
export const getPendingApprovals = (params = {}) => api.get('/sessions/pending-approvals', { params });

// 2. Staff hands over a unit and types its ID (like FB-007)
export const approveRequest = (id, unitCode) => api.post(`/sessions/${id}/approve`, { unitCode });
export const rejectRequest = (id, reason) => api.post(`/sessions/${id}/reject`, { reason });

export const getPendingReturns = (params = {}) => api.get('/sessions/pending-returns', { params });

// 4. Staff checks the item and confirms. DAMAGED creates a damage report on the server.
export const confirmReturn = (id, { conditionVerified, note }) =>
  api.post(`/sessions/${id}/confirm-return`, { conditionVerified, note });

// "The item in my hand is not the one that was issued"
export const flagMismatch = (id, note) => api.post(`/sessions/${id}/flag-mismatch`, { note });

export const getActiveSessions = (params = {}) => api.get('/sessions/active', { params });
export const getOverdueSessions = (params = {}) => api.get('/sessions/overdue', { params });