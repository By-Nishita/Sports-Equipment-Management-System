import api from './axios';

// Admin only
export const getUsers = (params) => api.get('/users', { params });
export const issueTempPassword = (id) => api.post(`/users/${id}/temp-password`);

// Any logged-in user: own details plus stats { user, stats }
export const getMyProfile = () => api.get('/users/me/profile');
// Only the phone can be changed here ("" clears it)
export const updateMyProfile = ({ phone }) => api.patch('/users/me', { phone });
// file = a File from <input type="file">; sent as multipart field "photo"
export const uploadMyPhoto = (file) => {
  const form = new FormData();
  form.append('photo', file);
  return api.post('/users/me/photo', form);
};

// ---- Admin: accounts ----
// body: { isActive?: boolean, role?: 'student' | 'staff' }. Reply: { success, message, data: user }
export const updateUser = (id, body) => api.patch(`/users/${id}`, body);

// ---- Admin: student CSV import. file = a File; sent as multipart field "file" ----
const csvForm = (file) => {
  const form = new FormData();
  form.append('file', file);
  return form;
};
// Checks the file and returns counts. Changes nothing.
export const dryRunImport = (file) => api.post('/users/import/dry-run', csvForm(file));
// Really imports. Reply data: { created, updated, failed, invalidCount, duplicateCount }
export const runImport = (file) => api.post('/users/import', csvForm(file));
