// src/api/registerSessions.js
import { api } from "./client";

export async function getCurrentRegister(signal) {
  try {
    const res = await api.get("/api/pos/registers/current", { signal });
    return res.data || null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function openRegister(payload) {
  const { data } = await api.post("/api/pos/registers/open", payload);
  return data;
}

export async function closeRegister(id, payload) {
  if (!id && id !== 0) {
    throw new Error("Missing register session id for closeRegister");
  }
  const { data } = await api.post(`/api/pos/registers/${id}/close`, payload);
  return data;
}

export async function listRegisterSessions(params = {}, signal) {
  const { data } = await api.get("/api/pos/registers", { params, signal });
  return data;
}

export async function getRegisterSession(id, signal) {
  const { data } = await api.get(`/api/pos/registers/${id}`, { signal });
  return data;
}

