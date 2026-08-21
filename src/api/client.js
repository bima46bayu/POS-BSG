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

// Guard against a burst of parallel 401s (e.g. a page firing 6 queries at once)
// producing six redirects. Reset once the app has navigated.
let emitting401 = false;
function emitUnauthorized() {
  if (emitting401) return;
  emitting401 = true;
  try {
    unauthorizedHandlers.forEach(h => { try { h(); } catch {} });
  } finally {
    // Release on the next tick so the in-flight 401 wave is collapsed into one
    // notification, but a genuinely new 401 later still gets handled.
    setTimeout(() => { emitting401 = false; }, 0);
  }
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

// RESPONSE: satu jalur penanganan 401 lewat pub/sub di atas.
// Sebelumnya di sini ada window.location.replace("/") yang mem-reload penuh,
// sehingga subscriber onUnauthorized tidak pernah jalan dan cache React Query
// tidak pernah dibersihkan. Sekarang emit saja, biar UI yang menavigasi.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
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
