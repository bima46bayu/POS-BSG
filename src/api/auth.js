// src/api/auth.js
import { api, STORAGE_KEY } from "./client";

export async function loginRequest(email, password) {
  const { data } = await api.post("/api/login", { email, password });
  // data expected: { token, user, expires_at }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function logoutRequest() {
  try {
    await api.post("/api/logout");
  } catch (error) {
    console.error("Logout failed:", error);
  }
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuth() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  const auth = getAuth();
  if (!auth?.token) return false;

  // ✅ TAMBAHAN: Check expiration di client side
  if (auth.expires_at) {
    const now = new Date();
    const expiresAt = new Date(auth.expires_at);

    if (now > expiresAt) {
      // Token sudah expired, hapus dari storage
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  return true;
}

// ✅ TAMBAHAN: Helper untuk debug
export function getTokenExpiration() {
  const auth = getAuth();
  if (!auth?.expires_at) return null;

  const expiresAt = new Date(auth.expires_at);
  const now = new Date();

  return {
    expiresAt: expiresAt.toLocaleString('id-ID'),
    isExpired: now > expiresAt,
    timeRemaining: Math.max(0, expiresAt - now),
    timeRemainingMinutes: Math.max(0, Math.floor((expiresAt - now) / 60000)),
  };
}