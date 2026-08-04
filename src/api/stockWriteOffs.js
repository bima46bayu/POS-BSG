// src/api/stockWriteOffs.js
import { api } from "./client";

/** Waste / spoiled / expired write-offs (consumes FIFO layers). */
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

export async function createWriteOff(payload, signal) {
  // payload: { store_location_id, product_id, qty, reason, note? }
  const { data } = await api.post("/api/stock-write-offs", payload, { signal });
  return data;
}
