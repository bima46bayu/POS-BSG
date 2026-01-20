import { api } from "./client";

export async function fetchPaymentRequestCoas(params = {}) {
  const res = await api.get("/api/coas", { params });
  const raw = res.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  return [];
}

export async function createPaymentRequestCoa(payload) {
  const res = await api.post("/api/coas", payload);
  return res.data;
}

export async function updatePaymentRequestCoa(id, payload) {
  const res = await api.put(`/api/coas/${id}`, payload);
  return res.data;
}

export async function deletePaymentRequestCoa(id) {
  const res = await api.delete(`/api/coas/${id}`);
  return res.data;
}
