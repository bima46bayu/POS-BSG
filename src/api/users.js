// src/api/users.js
import { api } from "./client";

// normalize: API bisa return {user: {...}} atau langsung { ... }
export async function getMyProfile(signal) {
  const { data } = await api.get("/api/me", { signal });
  return data?.user ?? data; // -> user object
}

// PUT ganti cabang user aktif
export async function updateMyStore({ store_location_id }, signal) {
  const { data } = await api.put("/api/me/store", { store_location_id }, { signal });
  // backend return { message, user }
  return data.user ?? data;
}

// (opsional) daftar lokasi toko untuk dropdown pemilihan cabang
export async function listStoreLocations({ search, per_page = 50 } = {}, signal) {
  const params = {};
  if (search) params.search = search;
  if (per_page) params.per_page = per_page;
  const { data } = await api.get("/api/store-locations", { params, signal });
  // jika backend pakai paginate Laravel: { data: [...], ...meta }
  return Array.isArray(data) ? data : (data.data ?? data);
}

export async function getMe(signal) {
  const { data } = await api.get("/api/me", { signal });
  // Expect: { id, name, email, role, store_location_id, ... }
  return data?.data || data;
}