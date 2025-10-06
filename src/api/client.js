// src/api/client.js
import axios from "axios";

// ===== Build-time ENV (CRA) + fallback =====
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
export const STORAGE_KEY  = process.env.REACT_APP_STORAGE_KEY || "pos_auth";

// ===== Axios instance =====
export const api = axios.create({
  baseURL: API_BASE_URL || undefined, // undefined => relative (dev)
  timeout: 20000,
});

// REQUEST INTERCEPTOR: Attach token
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // ignore JSON parse error
    }
  }
  return config;
});

// RESPONSE INTERCEPTOR: Handle 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // Hapus auth data
      localStorage.removeItem(STORAGE_KEY);
      
      // ✅ TAMBAHAN: Trigger storage event untuk sync antar tab
      window.dispatchEvent(new Event("storage"));
      
      // ✅ TAMBAHAN: Redirect ke halaman login
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// ===== Helper: jadikan URL absolut untuk gambar/path relatif =====
const ABS_URL = /^(https?:)?\/\//i;
export function toAbsoluteUrl(u, base = API_BASE_URL) {
  if (!u) return null;
  if (ABS_URL.test(u)) return u; // sudah absolut
  const b = (base || "").replace(/\/+$/, "");
  const p = String(u).replace(/^\/+/, "");
  return b ? `${b}/${p}` : `/${p}`;
}