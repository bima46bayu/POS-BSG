// src/api/products.js
import { api } from "./client";

// ===== helper unwrap list (tetap) =====
const unwrapList = (data) => {
  if (Array.isArray(data)) return { items: data, meta: null };
  return { items: data?.data || [], meta: data?.meta || null };
};

// ===== LISTING =====
export async function getProducts(params = {}, signal) {
  const { data } = await api.get("/api/products", { params, signal });
  if (Array.isArray(data)) return { items: data, meta: null };
  return { items: data?.data || [], meta: data?.meta || null };
}

export async function getProductBySKU(sku) {
  if (!sku) return null;
  const { data } = await api.get("/api/products", { params: { sku } });
  const arr = Array.isArray(data) ? data : data?.data || [];
  if (Array.isArray(arr) && arr.length) return arr[0];
  if (!Array.isArray(data) && data?.id) return data;
  return null;
}

export function deleteProduct(id) {
  return api.delete(`/api/products/${id}`);
}

// ===== CREATE PRODUCT =====
export async function createProduct(body, signal) {
  const payload = {
    name: body.name,
    price: Number(body.price || 0),
    stock: Number(body.stock || 0),
    sku: body.sku || "",
    description: body.description || "",
    category_id: body.category_id || null,
    sub_category_id: body.sub_category_id || null,
  };
  const { data } = await api.post("/api/products", payload, { signal });
  return data?.data || data; // kembalikan object product (yang punya id)
}

// ===== UPLOAD IMAGE (sesuai path kamu) =====
// POST /api/products/{id}/upload  (field: image)
export async function uploadProductImage(id, file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post(`/api/products/${id}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data || data;
}

// ===== CREATE + (opsional) UPLOAD IMAGES =====
export async function createProductWithImages(body, signal) {
  const product = await createProduct(body, signal);
  const productId = product?.id || product?.data?.id;

  if (productId && Array.isArray(body.images) && body.images.length) {
    for (const file of body.images) {
      await uploadProductImage(productId, file);
    }
  }
  return product;
}
