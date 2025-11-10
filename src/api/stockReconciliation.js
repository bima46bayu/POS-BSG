// src/api/stockReconciliation.js
import { api } from "./client";

// respons fleksibel: { items, meta } | { data, meta } | []
const unwrapList = (res) => {
  const data = res?.data ?? res;
  const items = data?.items ?? data?.data ?? data ?? [];
  const meta  = data?.meta ?? null;
  return { items: Array.isArray(items) ? items : [], meta };
};

export async function listReconciliations(params = {}, signal) {
  const { data } = await api.get("/api/stock-reconciliation", { params, signal });
  return unwrapList(data);
}

export async function createReconciliation(payload = {}, signal) {
  // payload opsional: { store_id, date_from, date_to, note }
  const { data } = await api.post("/api/stock-reconciliation", payload, { signal });
  return data;
}

export async function getReconciliation(id, params = {}, signal) {
  const { data } = await api.get(`/api/stock-reconciliation/${id}`, { params, signal });
  return data;
}

export async function downloadTemplate(params = {}, signal) {
  // server mengembalikan file xlsx
  const res = await api.get("/api/stock-reconciliation/template", {
    params,
    responseType: "blob",
    signal,
  });
  return res.data; // Blob
}

export async function uploadReconciliationFile(id, file, signal) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/api/stock-reconciliation/${id}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });
  return data;
}

export async function applyReconciliation(id, signal) {
  const { data } = await api.post(`/api/stock-reconciliation/${id}/apply`, {}, { signal });
  return data;
}

export async function deleteReconciliation(id, signal) {
  const { data } = await api.delete(`/api/stock-reconciliation/${id}`, { signal });
  return data;
}