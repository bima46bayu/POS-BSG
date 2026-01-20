import { api } from "./client";

/**
 * Ambil semua rekening
 */
export async function fetchBankAccounts() {
  const res = await api.get("/api/bank-accounts");
  const data = res.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Tambah rekening
 */
export async function createBankAccount(payload) {
  const res = await api.post("/api/bank-accounts", payload);
  return res.data;
}

/**
 * Update rekening
 */
export async function updateBankAccount(id, payload) {
  const res = await api.put(`/api/bank-accounts/${id}`, payload);
  return res.data;
}

/**
 * Hapus rekening
 */
export async function deleteBankAccount(id) {
  const res = await api.delete(`/api/bank-accounts/${id}`);
  return res.data;
}
