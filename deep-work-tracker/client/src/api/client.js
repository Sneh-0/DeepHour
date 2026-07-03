import axios from 'axios';

// Token lives in memory for requests; localStorage only persists it across
// page reloads. setAuthToken keeps both in sync.
let authToken = localStorage.getItem('token');

export function setAuthToken(token) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getAuthToken() {
  return authToken;
}

// '/api' is proxied to the Express server by Vite (see vite.config.js),
// so the browser talks same-origin and CORS never enters the picture in dev.
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

// If a protected call comes back 401 the token is expired/invalid — clear it
// and send the user to login. Auth endpoints are excluded (a wrong password
// is also a 401, and that one belongs to the login form).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.startsWith('/auth')) {
      setAuthToken(null);
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

// One place to turn any axios error into a human sentence.
export function errorMessage(err) {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server — is it running?';
  return 'Something went wrong. Please try again.';
}

export default api;
