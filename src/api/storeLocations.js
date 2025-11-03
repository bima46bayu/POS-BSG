import { api } from "./client";

// respons fleksibel: { items, meta } | { data, meta } | []
const unwrapList = (res) => {
  const data = res?.data ?? res;
  const items = data?.items ?? data?.data ?? data ?? [];
  const meta  = data?.meta ?? null;
  return { items: Array.isArray(items) ? items : [], meta };
};

export async function listStoreLocations(params = { per_page: 100 }, signal) {
  const { data } = await api.get("/api/store-locations", { params, signal });
  return unwrapList(data);
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

/** GET /api/store-locations/:id  -> { id, code, name, address, phone, ... } */
export async function getStoreLocation(id, signal) {
  if (!id) return null;
  const { data } = await api.get(`/api/store-locations/${id}`, { signal });
  // respons kamu langsung objek, tapi tetap aman kalau suatu hari dibungkus {data:...}
  return data?.data ?? data ?? null;
}