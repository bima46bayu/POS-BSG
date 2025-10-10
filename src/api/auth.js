// src/api/auth.js
import { api, STORAGE_KEY } from "./client";
import { queryClient } from "../lib/queryClient"; // pastikan ada instance queryClient yang sama dipakai di app

/** Helper: pasang/bersihkan header Authorization di axios */
function applyAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** Helper: reset semua cache & beri sinyal ke UI untuk reset state lokal (filters, dsb) */
function resetAppState() {
  try {
    queryClient.clear(); // buang seluruh cache React Query
  } catch (e) {
    // no-op
  }
  // Opsional: broadcast event bila ada store/filters yang perlu ikut reset
  window.dispatchEvent(new Event("app:reset"));
}

export async function loginRequest(email, password) {
  const { data } = await api.post("/api/login", { email, password });
  // { token, user, expires_at }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // 👉 langsung hard redirect (atau reload)
  // window.location.reload(); // kalau mau reload halaman sekarang
  window.location.replace("/dashboard"); // arahkan ke dashboard
  return data; // (opsional, tidak akan dipakai karena sudah redirect)
}

export async function logoutRequest() {
  try { await api.post("/api/logout"); } catch (_) {}
  localStorage.removeItem(STORAGE_KEY);

  // 👉 langsung hard redirect ke login
  window.location.replace("/");
}

/** ===== UTIL ===== */
export function getAuth() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    const auth = raw ? JSON.parse(raw) : null;
    // saat bootstrap app, kalau ada token—pasang header-nya juga
    if (auth?.token) applyAuthHeader(auth.token);
    return auth;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  const auth = getAuth();
  if (!auth?.token) return false;

  // Cek expired di sisi klien (opsional)
  if (auth.expires_at) {
    const now = new Date();
    const expiresAt = new Date(auth.expires_at);
    if (now > expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      applyAuthHeader(null);
      return false;
    }
  }
  return true;
}

export function getTokenExpiration() {
  const auth = getAuth();
  if (!auth?.expires_at) return null;

  const expiresAt = new Date(auth.expires_at);
  const now = new Date();
  return {
    expiresAt: expiresAt.toLocaleString("id-ID"),
    isExpired: now > expiresAt,
    timeRemaining: Math.max(0, +expiresAt - +now),
    timeRemainingMinutes: Math.max(0, Math.floor((+expiresAt - +now) / 60000)),
  };
}
