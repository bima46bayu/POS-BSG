import { api } from "./client";

// unwrap respons agar aman untuk paginate (object) & get() (array)
const unwrapList = (data) => {
  if (Array.isArray(data)) return { items: data, meta: null };
  return { items: data?.data || [], meta: data?.meta || null };
};

export async function getProducts(params = {}) {
  const { data } = await api.get("/api/products", { params });
  return unwrapList(data); // -> { items, meta }
}

export async function getProductBySKU(sku) {
  if (!sku) return null;
  const { data } = await api.get("/api/products", { params: { sku } });
  const arr = Array.isArray(data) ? data : data?.data || [];
  if (Array.isArray(arr) && arr.length) return arr[0];
  if (!Array.isArray(data) && data?.id) return data;
  return null;
}
