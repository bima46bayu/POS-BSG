import { api } from "./client";

const KEY = process.env.REACT_APP_STORAGE_KEY;

export async function loginRequest(email, password) {
  const { data } = await api.post("/api/login", { email, password });
  // data expected: { token, user }
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export async function logoutRequest() {
  try { await api.post("/api/logout"); } catch {}
  localStorage.removeItem(KEY);
}

export function getAuth() {
  const raw = localStorage.getItem(KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function isLoggedIn() {
  return !!getAuth()?.token;
}
