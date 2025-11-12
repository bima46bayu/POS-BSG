// src/api/stockReconciliation.js
import { api } from "./client";

/** Helper kecil untuk list response fleksibel */
const unwrapList = (res) => {
  const data = res?.data ?? res;
  const items = data?.items ?? data?.data ?? data ?? [];
  const meta  = data?.meta ?? null;
  return { items: Array.isArray(items) ? items : [], meta };
};

/* =========================
 * LIST & CREATE
 * ========================= */
export async function listReconciliations(params = {}, signal) {
  const { data } = await api.get("/api/stock-reconciliation", { params, signal });
  return unwrapList(data);
}

export async function createReconciliation(payload, signal) {
  // payload: { name?, store_location_id, date_from?, date_to?, note? }
  const { data } = await api.post("/api/stock-reconciliation", payload, { signal });
  return data;
}

/* =========================
 * DETAIL
 * ========================= */
export async function getReconciliation(id, signal) {
  const { data } = await api.get(`/api/stock-reconciliation/${id}`, { signal });
  // Normalisasi agar komponen bisa akses data.header / data.items
  const head = data?.header ?? data?.reconciliation ?? data;
  const items = data?.items ?? [];
  return { header: head, items };
}

/* =========================
 * BULK UPDATE ITEMS (inline)
 * ========================= */
// payload: { items: [{ id, physical_qty }, ...] }
export async function bulkUpdateReconciliationItems(id, payload, signal) {
  const { data } = await api.patch(`/api/stock-reconciliation/${id}/items`, payload, { signal });
  return data;
}

/* =========================
 * EXPORT TEMPLATE (download)
 * ========================= */
/**
 * Download template Excel.
 * Prioritas rute baru: GET /api/stock-reconciliation/{id}/template
 * Fallback rute lama (jika masih ada): GET /api/stock-reconciliation/template?store_id&date_from&date_to
 *
 * Arg:
 *  { recon_id?, store_id?, date_from?, date_to? }
 *
 * Return: Blob (xlsx)
 */
export async function downloadTemplate({ recon_id, store_id, date_from, date_to } = {}, signal) {
  const headers = {
    // Supaya server langsung kirim XLSX dan browser tidak mencoba parse JSON
    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  // 1) Coba rute baru yang pakai ID di path
  if (recon_id != null) {
    try {
      const res = await api.get(`/api/stock-reconciliation/${recon_id}/template`, {
        responseType: "blob",
        headers,
        signal,
      });

      // Jika server salah kirim JSON error, baca & lemparkan
      const ct = res.headers?.["content-type"] || "";
      if (ct.includes("application/json")) {
        const text = await res.data.text?.() ?? "";
        throw new Error(text || "Gagal mengunduh (JSON error)");
      }
      return res.data; // Blob
    } catch (e) {
      // Jatuhkan ke fallback hanya jika 404 (Not Found) pada rute baru
      const status = e?.response?.status;
      if (status !== 404) throw e;
    }
  }

  // 2) Fallback rute lama (query)
  const params = {};
  if (store_id != null) params.store_id = store_id;
  if (date_from) params.date_from = date_from;
  if (date_to)   params.date_to   = date_to;

  const res2 = await api.get("/api/stock-reconciliation/template", {
    params,
    responseType: "blob",
    headers,
    signal,
  });

  const ct2 = res2.headers?.["content-type"] || "";
  if (ct2.includes("application/json")) {
    // Baca pesan error JSON dari blob
    let msg = "Gagal mengunduh Excel";
    try {
      const text = await res2.data.text();
      msg = JSON.parse(text)?.message ?? text ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res2.data; // Blob
}

/* =========================
 * UPLOAD EXCEL
 * ========================= */
export async function uploadReconciliationFile(id, file, signal) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/api/stock-reconciliation/${id}/upload`, form, {
    signal,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* =========================
 * APPLY (commit ke ledger/layers)
 * ========================= */
export async function applyReconciliation(id, signal) {
  const { data } = await api.post(`/api/stock-reconciliation/${id}/apply`, null, { signal });
  return data;
}

/* =========================
 * DELETE (hanya DRAFT)
 * ========================= */
export async function deleteReconciliation(id, signal) {
  const { data } = await api.delete(`/api/stock-reconciliation/${id}`, { signal });
  return data;
}

/* ====== Aliases untuk kompatibilitas lama (opsional) ====== */
// Beberapa komponenmu sempat mengimpor nama berbeda:
export const uploadReconciliationExcel = uploadReconciliationFile;
