// src/api/users.js
import { api } from "./client";

export async function getMyProfile(signal) {
  const { data } = await api.get("/api/me", { signal });
  return data?.data || data; // { id, name, email, role, store: { name,address,phone } }
}

export async function updateMyStore(payload, signal) {
  const { data } = await api.put("/api/me/store", payload, { signal });
  return data?.data || data; // { store: {...} }
}
