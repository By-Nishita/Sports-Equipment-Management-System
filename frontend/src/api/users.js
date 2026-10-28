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
