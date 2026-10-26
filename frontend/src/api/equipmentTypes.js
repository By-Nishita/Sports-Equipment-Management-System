import api from './axios';

// Equipment TYPES (Football, Cricket bat) and their units (FB-001, FB-002 ...).
// Every list reply looks like { success, message, data: [...], pagination }.

// All active types with counts: { counts: { total, available, inUse, damaged } }
export const getTypes = (params = {}) => api.get('/equipment/types', { params });

// The QR sticker holds a type identifier like "TYPE-FOOTBALL"
export const getTypeByQr = (qr) => api.get(`/equipment/types/by-qr/${encodeURIComponent(qr)}`);

// Staff/admin: AVAILABLE units of one type (suggestion list on the approval screen)
export const getAvailableUnits = (typeId, params = {}) =>
  api.get('/equipment/units/available', { params: { type: typeId, limit: 200, ...params } });
