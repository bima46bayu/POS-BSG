import { api } from "./client";

/**
 * Ambil semua payees
 */
export async function fetchPayees(params = {}) {
  const res = await api.get("/api/payees", { params });

  const raw = res.data;

  // normalisasi response
  if (Array.isArray(raw?.data)) return raw.data; // paginate / resource
  if (Array.isArray(raw)) return raw;            // plain array

  return [];
}

/**
 * Tambah payee
 */
export async function createPayee(payload) {
  const res = await api.post("/api/payees", payload);
  return res.data;
}

/**
 * Update payee
 */
export async function updatePayee(id, payload) {
  const res = await api.put(`/api/payees/${id}`, payload);
  return res.data;
}

/**
 * Hapus payee
 */
export async function deletePayee(id) {
  const res = await api.delete(`/api/payees/${id}`);
  return res.data;
}

