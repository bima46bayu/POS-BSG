// src/api/users.js
import { api } from "./client";

/* =========================
 * Helpers
 * ========================= */
function cleanParams(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === "" || v == null) return;
    out[k] = v;
  });
  return out;
}

const normUserRes = (data) => data?.user ?? data?.data ?? data;

/**
 * Normalisasi payload store agar SELALU menjadi array [{ id, name }]
 * Menerima berbagai bentuk respons: array langsung, {data: [...]}, {items: [...]}, atau nested.
 */
function normalizeStoresPayload(payload) {
  let arr = [];
  if (Array.isArray(payload)) {
    arr = payload;
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) arr = payload.data;
    else if (Array.isArray(payload.items)) arr = payload.items;
    else if (payload.data && Array.isArray(payload.data.data)) arr = payload.data.data; // jaga-jaga nested
  }

  return (arr || [])
    .map((s, i) => {
      const id =
        s?.id ??
        s?.store_location_id ??
        s?.value ??
        s?.storeId ??
        s?.store?.id ??
        (i + 1);

      const name =
        s?.name ??
        s?.store_name ??
        s?.label ??
        s?.title ??
        s?.store_location_name ??
        s?.store?.name ??
        (id != null ? `Store #${id}` : null);

      return id == null ? null : { id, name: name ?? `Store #${id}` };
    })
    .filter(Boolean);
}

/* =========================
 * Profile (me)
 * ========================= */
export async function getMyProfile(signal) {
  const { data } = await api.get("/api/me", { signal });
  return normUserRes(data);
}

export async function getMe(signal) {
  const { data } = await api.get("/api/me", { signal });
  return normUserRes(data);
}

export async function updateMyStore({ store_location_id }, signal) {
  const body = { store_location_id: store_location_id ?? null };
  const { data } = await api.put("/api/me/store", body, { signal });
  return normUserRes(data); // { message, user } -> user
}

/* =========================
 * Store Locations (dropdown)
 * ========================= */
export async function listStoreLocations({ search, per_page = 50 } = {}, signal) {
  const params = cleanParams({ search, per_page });
  const { data } = await api.get("/api/store-locations", { params, signal });
  // Kembalikan SELALU [{ id, name }]
  return normalizeStoresPayload(data);
}

/* =========================
 * Users - Listing & Detail
 * ========================= */
export async function listUsers(params = {}, signal) {
  const {
    page = 1,
    per_page = 10,
    search = "",           // <-- BIARKAN STRING KOSONG
    role = "",
    store_location_id = "",
  } = params;

  const numStore =
    store_location_id === "" ? undefined : Number(store_location_id);
  const roleLower = role ? String(role).toLowerCase() : undefined;

  // JANGAN pakai cleanParams agar `search: ""` TETAP TERKIRIM
  const query = {
    page,
    per_page,
    search,                             // <-- selalu ikut, walau ""
    ...(roleLower ? { role: roleLower } : {}),
    ...(numStore != null ? { store_location_id: numStore } : {}),
    // Jika BE juga menerima alias:
    // ...(numStore != null ? { store_id: numStore } : {}),
  };

  const { data } = await api.get("/api/users", { params: query, signal });
  return data;
}

/* =========================
 * Users - CRUD
 * ========================= */
export async function createUser(payload, signal) {
  // payload: { name, email, password, password_confirmation, role, store_location_id }
  const { data } = await api.post("/api/users", payload, { signal });
  return data;
}

export async function updateUser(id, payload, signal) {
  const { data } = await api.put(`/api/users/${id}`, payload, { signal });
  return data;
}

export async function deleteUser(id, signal) {
  const { data } = await api.delete(`/api/users/${id}`, { signal });
  return data;
}

/* =========================
 * Users - Actions
 * ========================= */
export async function updateUserRole(id, role, signal) {
  const { data } = await api.patch(`/api/users/${id}/role`, { role }, { signal });
  return data;
}

export async function resetUserPassword(id, newPassword, signal) {
  // Jika BE auto-generate password: body kosong juga ok
  const body = newPassword ? { password: newPassword } : {};
  const { data } = await api.post(`/api/users/${id}/reset-password`, body, { signal });
  return data;
}

/* =========================
 * Dropdown / Options
 * ========================= */
export async function fetchRoleOptions(signal) {
  const { data } = await api.get("/api/users/roles/options", { signal }); // e.g. ["admin","kasir"] atau [{value,label}]
  return data;
}
