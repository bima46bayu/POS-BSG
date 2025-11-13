// src/api/inventory.js
import { api } from "./client";

/**
 * Valuation per product dari endpoint /inventory/products
 * NOTE: export dengan 2 nama agar kompatibel:
 * - fetchInventoryValuation (nama baru)
 * - fetchInventoryProducts  (alias, kompatibel versi lama)
 */
export async function fetchInventoryValuation(params = {}) {
  const { data } = await api.get("api/inventory/products", { params });
  return (
    data || {
      items: [],
      meta: { current_page: params.page || 1, per_page: params.per_page || 10, total: 0, last_page: 1 },
    }
  );
}
// alias (biar kode lama yang masih import fetchInventoryProducts tetap jalan)
export const fetchInventoryProducts = fetchInventoryValuation;

/** SUMMARY: GET /inventory/products/:id/summary */
export async function getProductSummary(productId, params = {}, signal) {
  const { data } = await api.get(`api/inventory/products/${productId}/summary`, {
    params,
    signal,
  });
  return data || { revenue: 0, cogs: 0, stock_in: 0, stock_out: 0, stock_ending: 0, cogs: 0, gross_profit: 0,};
}

/** LOGS: GET /inventory/products/:id/logs?page&per_page */
export async function getProductLogs(productId, { page = 1, per_page = 10 } = {}) {
  const { data } = await api.get(`api/inventory/products/${productId}/logs`, {
    params: { page, per_page },
  });
  return data || { items: [], meta: { current_page: page, per_page, total: 0, last_page: 1 } };
}

export async function exportProductStockCard(productId, params = {}) {
  // params: { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }
  const { data } = await api.get(`/api/inventory/${productId}/stock-card/export`, {
    params,
    responseType: "blob", // penting: PDF blob
  });
  return data; // Blob
}

export async function getProductsSummaryBatch(productIds = [], params = {}, signal) {
  // Normalisasi & filter kosong
  const arr = Array.isArray(productIds)
    ? productIds.filter((x) => x != null && String(x).trim() !== "")
    : String(productIds || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

  // Jangan call API kalau tidak ada id
  if (arr.length === 0) {
    return { items: [], totals: { cogs: 0, gross_profit: 0 }, count: 0 };
  }

  const qs = {
    ...params,
    product_ids: arr.join(","), // <-- pastikan terkirim
  };
  // kompat nama param
  if (qs.from && !qs.date_from) qs.date_from = qs.from;
  if (qs.to && !qs.date_to) qs.date_to = qs.to;

  const { data } = await api.get("api/inventory/products/summary", { params: qs, signal });

  // ==== NORMALISASI ROBUST ====
  const d = data || {};
  const items = Array.isArray(d.items) ? d.items : Array.isArray(d.data) ? d.data : [];

  // Totals bisa punya berbagai nama kunci
  const t = d.totals || d.total || {};
  const totalCogs =
    Number(t?.cogs ?? t?.cogs_total ?? t?.total_cogs ?? 0) ||
    items.reduce((a, x) => a + Number(x?.cogs ?? x?.cogs_total ?? 0), 0);

  const totalGp =
    Number(t?.gross_profit ?? t?.gp ?? t?.gross_profit_total ?? 0) ||
    items.reduce((a, x) => a + Number(x?.gross_profit ?? x?.gp ?? x?.gross_profit_total ?? 0), 0);

  return {
    items: items.map((it) => ({
      product_id: Number(it.product_id ?? it.id ?? 0),
      cogs: Number(it.cogs ?? it.cogs_total ?? 0),
      gross_profit: Number(it.gross_profit ?? it.gp ?? it.gross_profit_total ?? 0),
    })),
    totals: { cogs: Number(totalCogs || 0), gross_profit: Number(totalGp || 0) },
    count: Number(d.count ?? d.total ?? items.length ?? 0),
    meta: d.meta || null,
  };
}