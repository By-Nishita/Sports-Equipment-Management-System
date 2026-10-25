import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

// Har request ke saath token automatically bhej do
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Look at every REPLY from the backend before the page sees it.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = error.config?.url || '';

    // Backend says "change your password first" => remember it and go to the change page.
    if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
      try {
        const user = JSON.parse(localStorage.getItem('user')) || {};
        user.mustChangePassword = true;
        localStorage.setItem('user', JSON.stringify(user));
      } catch {
        /* ignore a broken localStorage */
      }
      if (window.location.pathname !== '/change-password') window.location.assign('/change-password');
    }

    // Token no longer valid (expired, or password changed elsewhere) => back to login.
    // A wrong password on the login page is also a 401, so skip that one.
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }

    return Promise.reject(error);
  }
);

export default api;
