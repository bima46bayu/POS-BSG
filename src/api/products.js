// src/api/products.js
import { api } from "./client";

/* =========================
   Helpers
========================= */

// Normalisasi list agar selalu { items, meta, links }
function normalizeList(d, fallbackPerPage = 10) {
  // 1) Array murni
  if (Array.isArray(d)) {
    return {
      items: d,
      meta: {
        current_page: 1,
        per_page: d.length,
        last_page: 1,
        total: d.length,
      },
      links: { next: null, prev: null },
    };
  }

  // 2) Bentuk normalized { items, meta, links }
  if (d && Array.isArray(d.items)) {
    const meta = d.meta || {};
    const per = Number(meta.per_page ?? fallbackPerPage);
    const total = Number(meta.total ?? d.items.length);
    return {
      items: d.items,
      meta: {
        current_page: Number(meta.current_page ?? 1),
        per_page: per,
        last_page:
          meta.last_page != null ? Number(meta.last_page) : Math.max(1, Math.ceil(total / per)),
        total,
      },
      links: d.links ?? { next: null, prev: null },
    };
  }

  // 3) Laravel paginator root: { current_page, data, per_page, last_page, total, next_page_url, prev_page_url }
  if (d && Array.isArray(d.data)) {
    const per = Number(d.per_page ?? d.data.length ?? fallbackPerPage);
    const total = Number(d.total ?? d.data.length ?? 0);
    return {
      items: d.data,
      meta: {
        current_page: Number(d.current_page ?? 1),
        per_page: per,
        last_page: d.last_page != null ? Number(d.last_page) : Math.max(1, Math.ceil(total / per)),
        total,
      },
      links: {
        next: d.next_page_url ?? null,
        prev: d.prev_page_url ?? null,
      },
    };
  }

  // 4) Fallback aman
  return {
    items: [],
    meta: { current_page: 1, per_page: fallbackPerPage, last_page: 1, total: 0 },
    links: { next: null, prev: null },
  };
}

/* =========================
   Listing
========================= */

/**
 * GET /api/products
 * params mendukung: search, sku, category_id, sub_category_id, min_price, max_price, page, per_page, sort, dir
 * Selalu return { items, meta, links }
 */
export async function getProducts(params = {}, signal) {
  const { data } = await api.get("/api/products", { params, signal });
  return normalizeList(data, Number(params?.per_page ?? 10));
}

/**
 * Cari produk 1 item berdasarkan SKU (exact).
 * Menggunakan /api/products?sku=... agar cepat (exact match).
 * Return 1 object atau null.
 */
export async function getProductBySKU(sku, signal) {
  if (!sku) return null;
  const { data } = await api.get("/api/products", { params: { sku }, signal });
  const { items } = normalizeList(data);
  return items[0] ?? null;
}

/**
 * (Opsional) Ambil 1 produk by id jika kamu punya endpoint /api/products/{id}
 */
export async function getProduct(id, signal) {
  const { data } = await api.get(`/api/products/${id}`, { signal });
  // backend-mu return {data: {...}} atau object langsung
  return data?.data || data || null;
}

/* =========================
   Mutations
========================= */

export function deleteProduct(id, signal) {
  return api.delete(`/api/products/${id}`, { signal });
}

export async function createProduct(body, signal) {
  const payload = {
    name: body.name ?? "",
    price: Number(body.price ?? 0),
    stock: Number(body.stock ?? 0),
    sku: body.sku ?? "",
    description: body.description ?? "",
    category_id: body.category_id ?? null,
    sub_category_id: body.sub_category_id ?? null,
  };
  const { data } = await api.post("/api/products", payload, { signal });
  // backend-mu mengembalikan object produk langsung (201) → kembalikan apa adanya
  return data?.data || data;
}

// POST /api/products/{id}/upload  (field: image)
export async function uploadProductImage(id, file, signal) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post(`/api/products/${id}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });
  return data?.data || data;
}

// Create + upload banyak gambar (parallel biar cepat)
export async function createProductWithImages(body, signal) {
  const product = await createProduct(body, signal);
  const productId = product?.id || product?.data?.id;
  if (productId && Array.isArray(body.images) && body.images.length) {
    await Promise.all(body.images.map((f) => uploadProductImage(productId, f, signal)));
  }
  return product;
}

export async function updateProduct(id, body, signal) {
  if (!id) throw new Error("Missing product id");

  const toNull = (v) => (v === "" || v === undefined ? null : v);
  const toNum = (v) => Number(v ?? 0);

  const payload = {
    name: body.name ?? "",
    price: toNum(body.price),
    stock: toNum(body.stock),
    sku: body.sku ?? "",
    description: toNull(body.description),
    category_id: body.category_id ? Number(body.category_id) : null,
    sub_category_id: body.sub_category_id ? Number(body.sub_category_id) : null,
  };

  const { data } = await api.put(`/api/products/${id}`, payload, { signal });
  return data?.data || data;
}

export async function updateProductWithImages(id, body, signal) {
  const product = await updateProduct(id, body, signal);

  if (Array.isArray(body.images) && body.images.length) {
    await Promise.all(body.images.map((f) => uploadProductImage(id, f, signal)));
  }
  return product;
}
