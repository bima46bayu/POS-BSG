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
export async function getProductSummary(productId) {
  const { data } = await api.get(`api/inventory/products/${productId}/summary`);
  return data || { revenue: 0, cogs: 0, stock_in: 0, stock_out: 0, stock_ending: 0 };
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

