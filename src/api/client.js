// src/api/client.js
import axios from "axios";

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
export const STORAGE_KEY  = process.env.REACT_APP_STORAGE_KEY || "pos_auth";

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 20000,
});

// === Simple pub/sub untuk unauthorized ===
let unauthorizedHandlers = [];
export function onUnauthorized(fn) {
  unauthorizedHandlers.push(fn);
  return () => { unauthorizedHandlers = unauthorizedHandlers.filter(h => h !== fn); };
}
function emitUnauthorized() {
  unauthorizedHandlers.forEach(h => {
    try { h(); } catch {}
  });
}

// REQUEST: selalu pakai token terbaru
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      else delete config.headers.Authorization;
    } catch { delete config.headers.Authorization; }
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

// RESPONSE: 401 -> emit event (jangan reload full)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      // Hilangkan dispatch storage & redirect hard. Pakai event:
      emitUnauthorized();
    }
    return Promise.reject(err);
  }
);

// helper URL absolut (tetap)
const ABS_URL = /^(https?:)?\/\//i;
export function toAbsoluteUrl(u, base = API_BASE_URL) {
  if (!u) return null;
  if (ABS_URL.test(u)) return u;
  const b = (base || "").replace(/\/+$/, "");
  const p = String(u).replace(/^\/+/, "");
  return b ? `${b}/${p}` : `/${p}`;
}
