// src/api/suppliers.js
import { api } from "./client";

/* Normalizer => selalu { items, meta } */
function normalize(raw, params = {}) {
  const items =
    raw?.items ??
    raw?.data ??
    (Array.isArray(raw) ? raw : []);
  const arr = Array.isArray(items) ? items : [];

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

  const page = Number(params.page ?? 1);
  const per = Number(params.per_page ?? 10);
  const total = arr.length;
  const last = Math.max(1, Math.ceil(total / per));
  return {
    items: arr.slice((page - 1) * per, page * per),
    meta: { current_page: page, last_page: last, per_page: per, total },
  };
}

/** List suppliers: params { page, per_page, search, type } */
export async function listSuppliers(params = { page: 1, per_page: 10 }, signal) {
  const { data } = await api.get("/api/suppliers", { params, signal });
  return normalize(data, params);
}

/** Create supplier
 * payload minimal: { name }
 * opsional: { type, address, phone, email, pic_name, pic_phone }
 */
export async function createSupplier(payload, signal) {
  const { data } = await api.post("/api/suppliers", payload, { signal });
  return data;
}

/** Update supplier by id */
export async function updateSupplier(id, payload, signal) {
  const { data } = await api.put(`/api/suppliers/${id}`, payload, { signal });
  return data;
}

/** Delete supplier */
export async function deleteSupplier(id, signal) {
  const { data } = await api.delete(`/api/suppliers/${id}`, { signal });
  return data;
}
