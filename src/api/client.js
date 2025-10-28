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
  unauthorizedHandlers.forEach(h => { try { h(); } catch {} });
}

// REQUEST: selalu pakai token terbaru
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      else delete config.headers.Authorization;
    } catch {
      delete config.headers.Authorization;
    }
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

// RESPONSE: tahan spam 401 (once-only guard) + JANGAN lempar error
let isEmitting401 = false;
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // bersihkan sesi
      try { localStorage.removeItem(STORAGE_KEY); } catch {}

      // emit sekali untuk batch 401 yg beruntun
      if (!isEmitting401) {
        isEmitting401 = true;
        emitUnauthorized();
        Promise.resolve().then(() => { isEmitting401 = false; });
      }

      // ⬇️ penting: JANGAN throw/reject
      // kembalikan "fulfilled response" supaya tidak memicu overlay merah
      // caller (React Query / fetcher) akan menerima { data: null, __unauthorized: true }
      return Promise.resolve({
        data: null,
        status: 401,
        headers: err?.response?.headers ?? {},
        config: err?.config,
        request: err?.request,
        __unauthorized: true,
      });
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

/**
 * Pasang di App: 401 → cancel semua query, clear cache, redirect ke /unauthorized
 */
export function installUnauthorizedRedirect({ queryClient, navigate, loginPath = "/unauthorized" }) {
  return onUnauthorized(() => {
    try {
      queryClient?.cancelQueries?.();
      queryClient?.clear?.();
    } catch {}
    if (typeof navigate === "function") {
      navigate(loginPath, { replace: true });
    } else {
      window.location.href = loginPath;
    }
  });
}
