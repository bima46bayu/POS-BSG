// src/api/sales.js
import { api } from "./client";

/**
 * @typedef {Object} SalesMeta
 * @property {number} current_page
 * @property {number} per_page
 * @property {number} last_page
 * @property {number} total
 *
 * @typedef {Object} SalesResponse
 * @property {Array<any>} items
 * @property {SalesMeta} meta
 * @property {{ next: string|null, prev: string|null }} links
 */

/** Helper: pastikan angka */
const N = (v, fallback = 0) => (v == null ? fallback : Number(v));

/**
 * Normalisasi berbagai bentuk respons backend menjadi { items, meta, links }.
 * Mendukung:
 *  - Array murni
 *  - Laravel paginator default (root fields)
 *  - Payload sudah dinormalisasi { items, meta, links }
 *  - Fallback aman
 * @param {any} d
 * @param {{ per_page?: number }} params
 * @returns {SalesResponse}
 */
function normalizeSalesResponse(d, params = {}) {
  // 1) Array murni
  if (Array.isArray(d)) {
    const total = d.length;
    return {
      items: d,
      meta: { current_page: 1, per_page: total, last_page: 1, total },
      links: { next: null, prev: null },
    };
  }

  // 2) Laravel paginator default: { current_page, data, per_page, last_page, total, ... }
  if (d && typeof d === "object" && Array.isArray(d.data)) {
    const per = N(d.per_page, d.data.length || N(params.per_page, 10));
    const total = N(d.total, d.data.length);
    const last = d.last_page != null ? N(d.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
    return {
      items: d.data,
      meta: {
        current_page: N(d.current_page, 1),
        per_page: per,
        last_page: last,
        total,
      },
      links: {
        next: d.next_page_url ?? null,
        prev: d.prev_page_url ?? null,
      },
    };
  }

  // 3) Sudah dinormalisasi: { items, meta, links }
  if (d && Array.isArray(d.items) && d.meta) {
    const per = N(d.meta.per_page, d.items.length || N(params.per_page, 10));
    const total = N(d.meta.total, d.items.length);
    const last =
      d.meta.last_page != null ? N(d.meta.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
    return {
      items: d.items,
      meta: {
        current_page: N(d.meta.current_page, 1),
        per_page: per,
        last_page: last,
        total,
      },
      links: d.links ?? { next: null, prev: null },
    };
  }

  // 4) Fallback aman
  const arr = Array.isArray(d?.data) ? d.data : [];
  const per = N(d?.per_page, N(params.per_page, 10));
  const total = N(d?.total, arr.length);
  const last = d?.last_page != null ? N(d.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
  return {
    items: arr,
    meta: {
      current_page: N(d?.current_page, 1),
      per_page: per,
      last_page: last,
      total,
    },
    links: {
      next: d?.next_page_url ?? null,
      prev: d?.prev_page_url ?? null,
    },
  };
}

/**
 * BUAT TRANSAKSI BARU
 * @param {Object} payload
 * @returns {Promise<any>}
 */
export async function createSale(payload) {
  const { data } = await api.post("/api/sales", payload);
  return data;
}

/**
 * DETAIL 1 TRANSAKSI
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export async function getSale(id) {
  const { data } = await api.get(`/api/sales/${id}`);
  return data?.data || data;
}

/**
 * LIST TRANSAKSI (server-side)
 * GET /api/sales?search=&payment_method=&date_from=&date_to=&page=&per_page=&sort=&dir=
 * @param {Object} params
 * @param {AbortSignal} [signal]
 * @returns {Promise<SalesResponse>}
 */
export async function getSales(params = {}, signal) {
  const res = await api.get("/api/sales", { params, signal });
  return normalizeSalesResponse(res.data, params);
}

/**
 * VOID / REJECT TRANSAKSI
 * @param {string|number} saleId
 * @param {Object} payload
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export async function voidSale(saleId, payload = {}, signal) {
  const { data } = await api.post(`/api/sales/${saleId}/void`, payload, { signal });
  return data;
}

export async function listSalesForDashboard(params = {}, signal) {
  // batasi aman di BE; di sini minta besar supaya range harian/bulanan cukup
  const p = { page: 1, per_page: 50000, ...params };
  const { items } = await getSales(p, signal); // getSales kamu sudah normalisasi
  return items;
}