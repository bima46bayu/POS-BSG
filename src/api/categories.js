// src/api/categories.js
import { api } from "./client";

/** ========= Helpers ========= */
const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/** Normalisasi respons list supaya selalu { items, meta } */
function normalizeListResponse(raw, fallback = {}) {
  // Bentuk umum BE: { items, meta } atau { data, meta } atau array polos
  const items =
    raw?.items ??
    raw?.data ??
    (Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);

  const arr = toArray(items);

  const m = raw?.meta ?? raw?.pagination ?? null;
  if (m) {
    return {
      items: arr,
      meta: {
        current_page: Number(m.current_page ?? m.currentPage ?? fallback.page ?? 1),
        last_page: Number(m.last_page ?? m.lastPage ?? m.total_pages ?? 1),
        per_page: Number(m.per_page ?? m.perPage ?? fallback.per_page ?? arr.length ?? 0),
        total: Number(m.total ?? arr.length ?? 0),
      },
    };
  }

  // Fallback jika BE tidak kirim meta (array polos)
  const perPage = Number(fallback.per_page ?? 10);
  const page = Number(fallback.page ?? 1);
  const total = arr.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const sliced =
    raw && !raw.items && !raw.data && Array.isArray(raw)
      ? arr.slice((page - 1) * perPage, page * perPage)
      : arr; // kalau BE sudah paginasi, jangan slice lagi

  return {
    items: sliced,
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total,
    },
  };
}

/** ========= Existing simple helpers (dipakai ProductPage) ========= */
// Tetap dipertahankan untuk kompatibilitas lama.
const unwrap = (data) => (Array.isArray(data) ? data : data?.data || []);

/** GET all categories (tanpa meta – legacy) */
export async function getCategories(params, signal) {
  // Support panggilan lama: getCategories() tanpa params
  const { data } = await api.get("/api/categories", { params, signal });
  return data?.items || data?.data || data || [];
}

/** GET all sub-categories (opsional filter by category_id) */
export async function getSubCategories(category_id, signal) {
  const { data } = await api.get("/api/sub-categories", {
    params: { category_id },
    signal,
  });
  return unwrap(data); // [{ id, name, category_id }]
}

/** ========= Baru: List + CRUD dengan meta ========= */

/**
 * List categories dengan dukungan pagination & search.
 * Selalu mengembalikan { items, meta }.
 * @param {Object} params { page, per_page, search }
 */
export async function listCategories(params = { page: 1, per_page: 10, search: "" }, signal) {
  const { data } = await api.get("/api/categories", { params, signal });
  return normalizeListResponse(data, params);
}

/**
 * Create category
 * payload minimal: { name }, opsional: { slug }
 */
export async function createCategory(payload, signal) {
  const { data } = await api.post("/api/categories", payload, { signal });
  return data;
}

/**
 * Update category by id
 * payload minimal: { name }, opsional: { slug }
 */
export async function updateCategory(id, payload, signal) {
  const { data } = await api.put(`/api/categories/${id}`, payload, { signal });
  return data;
}

/** Delete category by id */
export async function deleteCategory(id, signal) {
  const { data } = await api.delete(`/api/categories/${id}`, { signal });
  return data;
}

// === SUB-CATEGORIES with meta (baru) ===

/** Normalisasi list agar selalu { items, meta } */
const _norm = (raw, params = {}) => {
  const arr = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
    ? raw
    : [];
  const m = raw?.meta ?? raw?.pagination;
  if (m) {
    return {
      items: arr,
      meta: {
        current_page: Number(m.current_page ?? m.currentPage ?? params.page ?? 1),
        last_page: Number(m.last_page ?? m.lastPage ?? m.total_pages ?? 1),
        per_page: Number(m.per_page ?? m.perPage ?? params.per_page ?? arr.length ?? 0),
        total: Number(m.total ?? arr.length ?? 0),
      },
    };
  }
  const per = Number(params.per_page ?? 10);
  const page = Number(params.page ?? 1);
  const total = arr.length;
  const last = Math.max(1, Math.ceil(total / per));
  return {
    items: arr.slice((page - 1) * per, page * per),
    meta: { current_page: page, last_page: last, per_page: per, total },
  };
};

/**
 * List sub-categories (pagination & search).
 * params: { page, per_page, search, category_id }
 */
export async function listSubCategories(params = { page: 1, per_page: 10 }, signal) {
  const { data } = await api.get("/api/sub-categories", { params, signal });
  return _norm(data, params);
}

/** Create sub-category: { name, description?, category_id } */
export async function createSubCategory(payload, signal) {
  const { data } = await api.post("/api/sub-categories", payload, { signal });
  return data;
}

/** Update sub-category */
export async function updateSubCategory(id, payload, signal) {
  const { data } = await api.put(`/api/sub-categories/${id}`, payload, { signal });
  return data;
}

/** Delete sub-category */
export async function deleteSubCategory(id, signal) {
  const { data } = await api.delete(`/api/sub-categories/${id}`, { signal });
  return data;
}

