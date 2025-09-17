import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(process.env.REACT_APP_STORAGE_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(process.env.REACT_APP_STORAGE_KEY);
      // biarkan App yang mengatur tampilan login (tanpa redirect di sini)
    }
    return Promise.reject(err);
  }
);
