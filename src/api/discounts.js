// src/api/discounts.js
import { api, STORAGE_KEY } from "./client"; // ✅ IMPORT STORAGE_KEY

function getMyStoreIdFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.store_location_id ?? parsed?.store_location_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalisasi response list:
 * - paginate laravel: { data: [], meta: {...}, links: {...} }
 * - non paginate: []
 * Return shape standar: { items, meta, links, raw }
 */
function normalizeListResponse(payload) {
  if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
    return {
      items: payload.data,
      meta: payload.meta ?? null,
      links: payload.links ?? null,
      raw: payload,
    };
  }

  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: null,
      links: null,
      raw: payload,
    };
  }

  return { items: [], meta: null, links: null, raw: payload };
}

/**
 * LIST DISCOUNTS (AMAN CORS & PAGINATION)
 */
export async function listDiscounts(params = {}, signal) {
  const q = { ...params };

  if (!("per_page" in q)) q.per_page = 10;

  const res = await api.get("/api/discounts", {
    params: q,
    signal,
  });

  return normalizeListResponse(res.data);
}

export async function createDiscount(payload, signal) {
  // ✅ FIX: pakai /api/discounts
  const res = await api.post("/api/discounts", payload, { signal });
  return res.data;
}

export async function updateDiscount(id, payload, signal) {
  // ✅ FIX: pakai /api/discounts/:id
  const res = await api.put(`/api/discounts/${id}`, payload, { signal });
  return res.data;
}

export async function deleteDiscount(id, signal) {
  // ✅ FIX: pakai /api/discounts/:id
  const res = await api.delete(`/api/discounts/${id}`, { signal });
  return res.data;
}
