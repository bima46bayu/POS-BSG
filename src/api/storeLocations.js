// src/api/storeLocations.js
import { api } from "./client";

/** 
 * Normalisasi respons supaya selalu:
 * {
 *   items: [...],
 *   meta: { current_page, last_page, per_page, total }
 * }
 *
 * Support:
 * - Laravel paginator
 * - { items, meta }
 * - { data, meta }
 * - Array polos
 */
const normalizeList = (raw, params = {}) => {
  const data = raw?.data ?? raw;

  // ==== 1) Deteksi Laravel paginator ====
  const isLaravelPaginator =
    data &&
    typeof data === "object" &&
    Array.isArray(data.data) &&
    (data.current_page !== undefined || data.last_page !== undefined);

  if (isLaravelPaginator) {
    const items = data.data;
    return {
      items,
      meta: {
        current_page: Number(data.current_page ?? params.page ?? 1),
        last_page: Number(data.last_page ?? 1),
        per_page: Number(data.per_page ?? params.per_page ?? items.length),
        total: Number(data.total ?? items.length),
      },
    };
  }

  // ==== 2) Bentuk umum: { items, meta } atau { data, meta } ====
  const items =
    data?.items ??
    data?.data ??
    (Array.isArray(data) ? data : []);

  if (data?.meta) {
    return {
      items: Array.isArray(items) ? items : [],
      meta: {
        current_page: data.meta.current_page ?? params.page ?? 1,
        last_page: data.meta.last_page ?? 1,
        per_page: data.meta.per_page ?? params.per_page ?? items.length,
        total: data.meta.total ?? items.length,
      },
    };
  }

  // ==== 3) Array polos ====
  const arr = Array.isArray(items) ? items : [];
  const page = Number(params.page ?? 1);
  const per  = Number(params.per_page ?? arr.length);

  return {
    items: arr.slice((page - 1) * per, page * per),
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(arr.length / per)),
      per_page: per,
      total: arr.length,
    },
  };
};

export async function listStoreLocations(
  params = { page: 1, per_page: 10 },
  signal
) {
  const { data } = await api.get("/api/store-locations", { params, signal });
  return normalizeList(data, params);
}

export async function createStoreLocation(payload, signal) {
  const { data } = await api.post("/api/store-locations", payload, { signal });
  return data;
}

export async function updateStoreLocation(id, payload, signal) {
  const { data } = await api.put(`/api/store-locations/${id}`, payload, { signal });
  return data;
}

export async function deleteStoreLocation(id, signal) {
  const { data } = await api.delete(`/api/store-locations/${id}`, { signal });
  return data;
}

/** GET detail store location */
export async function getStoreLocation(id, signal) {
  if (!id) return null;
  const { data } = await api.get(`/api/store-locations/${id}`, { signal });
  return data?.data ?? data ?? null;
}

/**
 * Upload / ganti logo store.
 * Endpoint: POST /api/store-locations/{id}/logo
 * Body: form-data { logo: File }
 */
export async function uploadStoreLocationLogo(id, file, signal) {
  if (!id || !file) throw new Error("id dan file logo wajib diisi");

  const form = new FormData();
  form.append("logo", file);

  const { data } = await api.post(
    `/api/store-locations/${id}/logo`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      signal,
    }
  );

  // backend bisa return { data: store } atau langsung store
  return data?.data ?? data ?? null;
}
