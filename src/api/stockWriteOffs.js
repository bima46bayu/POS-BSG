// src/api/stockWriteOffs.js
import { api } from "./client";

/** Waste / spoiled / expired write-offs (draft → submit consumes FIFO). */
export async function listWriteOffs(params = {}, signal) {
  const { data } = await api.get("/api/stock-write-offs", { params, signal });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    meta: data?.meta ?? null,
  };
}

export async function getWriteOffSummary(params = {}, signal) {
  const { data } = await api.get("/api/stock-write-offs/summary", {
    params,
    signal,
  });
  return data;
}

export async function listWriteOffReasons(signal) {
  const { data } = await api.get("/api/stock-write-offs/reasons", { signal });
  return Array.isArray(data?.items) ? data.items : [];
}

/** Creates a DRAFT — stock is not reduced until submit. */
export async function createWriteOff(payload, signal) {
  const { data } = await api.post("/api/stock-write-offs", payload, { signal });
  return data;
}

export async function updateWriteOff(id, payload, signal) {
  const { data } = await api.put(`/api/stock-write-offs/${id}`, payload, {
    signal,
  });
  return data;
}

export async function submitWriteOff(id, signal) {
  const { data } = await api.post(
    `/api/stock-write-offs/${id}/submit`,
    {},
    { signal }
  );
  return data;
}

export async function deleteWriteOff(id, signal) {
  const { data } = await api.delete(`/api/stock-write-offs/${id}`, { signal });
  return data;
}
