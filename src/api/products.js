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

  // 3) Laravel paginator root
  // { current_page, data, per_page, last_page, total, next_page_url, prev_page_url }
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
 * params mendukung:
 * - pencarian: search, sku, category_id, sub_category_id, min_price/price_min, max_price/price_max
 * - paging/sort: page, per_page, sort, dir
 * - filter store: store_location_id (number), only_store (boolean | 0/1)
 * Selalu return { items, meta, links }
 */
export async function getProducts(params = {}, signal) {
  const {
    only_store,
    store_location_id,
    ...rest
  } = params || {};

  // BE menghendaki only_store sebagai 0/1 (jika dipakai)
  const finalParams = {
    ...rest,
    ...(store_location_id != null ? { store_location_id } : {}),
    ...(only_store != null ? { only_store: Number(Boolean(only_store)) } : {}),
  };

  const { data } = await api.get("/api/products", { params: finalParams, signal });
  return normalizeList(data, Number(finalParams?.per_page ?? 10));
}

/**
 * Cari produk 1 item berdasarkan SKU (exact).
 * Bisa dipersempit per store:
 *   getProductBySKU("ABC123", { store_location_id: 2, only_store: true })
 * Return 1 object atau null.
 */
export async function getProductBySKU(sku, opts = {}, signal) {
  if (!sku) return null;

  const { store_location_id, only_store, ...rest } = opts || {};
  const params = {
    sku,
    ...(store_location_id != null ? { store_location_id } : {}),
    ...(only_store != null ? { only_store: Number(Boolean(only_store)) } : {}),
    ...rest,
  };

  const { data } = await api.get("/api/products", { params, signal });
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

/**
 * Create product
 * - Staff/Kasir: tidak perlu kirim scope/store_location_id (BE bisa auto dari /api/me)
 * - Admin:
 *    - Global: set body.scope = "global"
 *    - Khusus store: set body.scope = "store" + body.store_location_id = <id>
 * - Jika body.image berupa File/Blob → otomatis pakai FormData (multipart)
 */
export async function createProduct(body = {}, signal) {
  // deteksi perlu FormData
  const hasFile = body?.image instanceof File || body?.image instanceof Blob;
  if (hasFile) {
    const fd = new FormData();
    if (body.sku) fd.append("sku", body.sku);
    fd.append("name", body.name ?? "");
    fd.append("price", String(Number(body.price ?? 0)));
    fd.append("stock", String(Number(body.stock ?? 0)));
    if (body.description != null) fd.append("description", body.description);
    if (body.category_id != null) fd.append("category_id", String(body.category_id));
    if (body.sub_category_id != null) fd.append("sub_category_id", String(body.sub_category_id));
    fd.append("image", body.image);

    // opsional (admin-only, aman jika staff mengirim tidak dipakai BE)
    if (body.scope) fd.append("scope", body.scope);
    if (body.store_location_id != null) fd.append("store_location_id", String(body.store_location_id));

    const { data } = await api.post("/api/products", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      signal,
    });
    return data?.data || data;
  }

  // JSON biasa
  const payload = {
    name: body.name ?? "",
    price: Number(body.price ?? 0),
    stock: Number(body.stock ?? 0),
    sku: body.sku ?? "",
    description: body.description ?? "",
    category_id: body.category_id ?? null,
    sub_category_id: body.sub_category_id ?? null,

    // opsional (admin-only)
    ...(body.scope ? { scope: body.scope } : {}),
    ...(body.store_location_id != null ? { store_location_id: body.store_location_id } : {}),
  };

  const { data } = await api.post("/api/products", payload, { signal });
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

/**
 * Update product
 * - Admin boleh kirim scope/store_location_id untuk ubah kepemilikan (global/store)
 * - Staff tidak perlu mengirim field tersebut (BE akan tolak jika tidak berhak)
 * - Jika body.image ada → gunakan updateProductWithImages atau endpoint upload terpisah
 */
export async function updateProduct(id, body = {}, signal) {
  if (!id) throw new Error("Missing product id");

  const toNull = (v) => (v === "" || v === undefined ? null : v);
  const toNum = (v) => Number(v ?? 0);

  // JSON saja (untuk file gunakan updateProductWithImages)
  const payload = {
    name: body.name ?? "",
    price: toNum(body.price),
    stock: toNum(body.stock),
    sku: body.sku ?? "",
    description: toNull(body.description),
    category_id: body.category_id ? Number(body.category_id) : null,
    sub_category_id: body.sub_category_id ? Number(body.sub_category_id) : null,

    // opsional (admin-only)
    ...(body.scope ? { scope: body.scope } : {}),
    ...(body.store_location_id != null ? { store_location_id: Number(body.store_location_id) } : {}),
  };

  const { data } = await api.put(`/api/products/${id}`, payload, { signal });
  return data?.data || data;
}

export async function updateProductWithImages(id, body = {}, signal) {
  const product = await updateProduct(id, body, signal);
  if (Array.isArray(body.images) && body.images.length) {
    await Promise.all(body.images.map((f) => uploadProductImage(id, f, signal)));
  }
  return product;
}

// Download template (Blob)
export async function downloadProductImportTemplate(signal) {
  const res = await api.get("/api/products/import/template", {
    responseType: "blob",
    signal,
  });
  return res.data; // Blob
}

// Import file excel
export async function importProductsExcel({ file, mode = "upsert" }, signal) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);
  const { data } = await api.post("/api/products/import", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });
  return data;
}