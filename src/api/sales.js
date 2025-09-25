// src/api/sales.js
import { api } from "./client";

/**
 * BUAT TRANSAKSI BARU
 * Payload contoh:
 * {
 *   cashier_id: 1,
 *   customer_name: "Budi",
 *   discount: 0,
 *   tax: 0,
 *   items: [{ product_id: 1, price: 120000, qty: 2, subtotal: 240000 }],
 *   payments: [{ method: "cash", amount: 400000, reference: null }]
 * }
 */
export async function createSale(payload) {
  const { data } = await api.post("/api/sales", payload);
  return data;
}

/**
 * DETAIL 1 TRANSAKSI
 * GET /api/sales/{id}
 * Expect: { id, code, created_at, cashier, customer_name, items, subtotal, discount, tax, total, paid, change, payments }
 */
export async function getSale(id) {
  const { data } = await api.get(`/api/sales/${id}`);
  return data?.data || data;
}

/**
 * LIST TRANSAKSI (server-side)
 * GET /api/sales?search=&payment_method=&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&page=&per_page=&sort=&dir=
 * Response bisa array atau {data, meta}
 */
export async function getSales(params = {}, signal) {
  const { data } = await api.get("/api/sales", { params, signal });
  if (Array.isArray(data)) {
    return {
      items: data,
      meta: { current_page: 1, last_page: 1, per_page: data.length, total: data.length },
    };
  }
  return {
    items: data?.data || [],
    meta: data?.meta || { current_page: 1, last_page: 1, per_page: params.per_page || 10, total: (data?.data || []).length },
  };
}

