// src/api/categories.js
import { api } from "./client";

/** ========= Helpers umum ========= */
const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/**
 * Normalisasi respons list supaya SELALU berbentuk:
 * {
 *   items: [...],
 *   meta: { current_page, last_page, per_page, total }
 * }
 *
 * Support:
 * - Laravel paginator: { current_page, data, last_page, per_page, total, ... }
 * - Bentuk umum: { items, meta } atau { data, meta }
 * - Array polos: [ ... ]
 */
function normalizeListResponse(raw, fallback = {}) {
  // ==== 1) Deteksi paginator Laravel ====
  const isLaravelPaginator =
    raw &&
    typeof raw === "object" &&
    Array.isArray(raw.data) &&
    (raw.current_page !== undefined || raw.last_page !== undefined);

  if (isLaravelPaginator) {
    const arr = toArray(raw.data);
    return {
      items: arr,
      meta: {
        current_page: Number(raw.current_page ?? fallback.page ?? 1),
        last_page: Number(raw.last_page ?? fallback.last_page ?? 1),
        per_page: Number(raw.per_page ?? fallback.per_page ?? arr.length ?? 0),
        total: Number(raw.total ?? arr.length ?? 0),
      },
    };
  }

  // ==== 2) Bentuk umum: { items, meta } atau { data, meta } ====
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

  // ==== 3) Fallback: array polos (tanpa meta dari BE) ====
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

/** ========= Helpers lama (legacy) ========= */
// dipakai di beberapa tempat lama, jangan dihapus dulu
const unwrap = (data) => (Array.isArray(data) ? data : data?.data || []);

/** ========= CATEGORIES (tanpa meta & dengan meta) ========= */

/** GET all categories (tanpa meta – legacy) */
export async function getCategories(params, signal) {
  const { data } = await api.get("/api/categories", { params, signal });
  // support bentuk lama: array langsung atau { data: [...] } atau { items: [...] }
  return data?.items || data?.data || data || [];
}

/**
 * List categories dengan dukungan pagination & search.
 * Selalu return { items, meta }.
 * params: { page, per_page, search }
 */
export async function listCategories(
  params = { page: 1, per_page: 10, search: "" },
  signal
) {
  const { data } = await api.get("/api/categories", { params, signal });
  return normalizeListResponse(data, params);
}

/**
 * Create category
 * payload minimal: { name }, optional: { slug }
 */
export async function createCategory(payload, signal) {
  const { data } = await api.post("/api/categories", payload, { signal });
  return data;
}

/**
 * Update category by id
 * payload minimal: { name }, optional: { slug }
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

/** ========= SUB-CATEGORIES ========= */

/** GET all sub-categories (opsional filter by category_id) – legacy */
export async function getSubCategories(category_id, signal) {
  const { data } = await api.get("/api/sub-categories", {
    params: { category_id },
    signal,
  });
  return unwrap(data); // [{ id, name, category_id }]
}

/**
 * Helper khusus sub-categories, pakai normalizer yang sama
 * supaya bentuknya konsisten { items, meta }.
 */
const _norm = (raw, params = {}) => normalizeListResponse(raw, params);

/**
 * List sub-categories (pagination & search).
 * params: { page, per_page, search, category_id }
 * Selalu return { items, meta }.
 */
export async function listSubCategories(
  params = { page: 1, per_page: 10 },
  signal
) {
  const { data } = await api.get("/api/sub-categories", { params, signal });
  return _norm(data, params);
}

/** Create sub-category: { name, category_id } (+ field lain kalau ada) */
export async function createSubCategory(payload, signal) {
  const { data } = await api.post("/api/sub-categories", payload, { signal });
  return data;
}

/** Update sub-category */
export async function updateSubCategory(id, payload, signal) {
  const { data } = await api.put(`/api/sub-categories/${id}`, payload, {
    signal,
  });
  return data;
}

/** Delete sub-category */
export async function deleteSubCategory(id, signal) {
  const { data } = await api.delete(`/api/sub-categories/${id}`, { signal });
  return data;
}
