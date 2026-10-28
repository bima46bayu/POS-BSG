import { api } from "./client";

export async function listHomePromos(signal) {
  const { data } = await api.get("/api/promotions", { signal });
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function createHomePromo(payload) {
  const { data } = await api.post("/api/promotions", payload);
  return data;
}

export async function updateHomePromo(id, payload) {
  const { data } = await api.put(`/api/promotions/${id}`, payload);
  return data;
}

export async function deleteHomePromo(id) {
  await api.delete(`/api/promotions/${id}`);
}
