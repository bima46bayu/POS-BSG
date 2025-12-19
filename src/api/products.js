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
          meta.last_page != null
            ? Number(meta.last_page)
            : Math.max(1, Math.ceil(total / per)),
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
        last_page:
          d.last_page != null
            ? Number(d.last_page)
            : Math.max(1, Math.ceil(total / per)),
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

const toNull = (v) => (v === "" || v === undefined ? null : v);
const toNum = (v) => Number(v ?? 0);

/**
 * Normalisasi inventory_type:
 * - kalau body.inventory_type ada → pakai itu
 * - else kalau body.is_stock_tracked ada → map ke stock/non_stock
 * - else default stock
 */
function resolveInventoryType(body = {}) {
  const raw = body?.inventory_type;
  if (raw != null && String(raw).trim() !== "") {
    const v = String(raw).toLowerCase().trim();
    if (v === "stock") return "stock";
    if (v === "non_stock" || v === "non-stock" || v === "non stock" || v === "service" || v === "jasa") {
      return "non_stock";
    }
    // fallback aman
    return "stock";
  }

  if (body?.is_stock_tracked !== undefined && body?.is_stock_tracked !== null) {
    return Number(body.is_stock_tracked) === 1 ? "stock" : "non_stock";
  }

  return "stock";
}

/* =========================
   Listing
========================= */

export async function getProducts(params = {}, signal) {
  const { only_store, store_location_id, ...rest } = params || {};

  const finalParams = {
    ...rest,
    ...(store_location_id != null ? { store_location_id } : {}),
    ...(only_store != null ? { only_store: Number(Boolean(only_store)) } : {}),
  };

  const { data } = await api.get("/api/products", { params: finalParams, signal });
  return normalizeList(data, Number(finalParams?.per_page ?? 10));
}

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

export async function getProduct(id, signal) {
  const { data } = await api.get(`/api/products/${id}`, { signal });
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
 * - Jika body.image berupa File/Blob → multipart
 * - Selain itu JSON biasa
 */
export async function createProduct(body = {}, signal) {
  const inventory_type = resolveInventoryType(body);

  // kalau non_stock, paksa stock = 0 agar konsisten
  const normalizedStock = inventory_type === "stock" ? toNum(body.stock) : 0;

  // deteksi perlu FormData
  const hasFile = body?.image instanceof File || body?.image instanceof Blob;

  if (hasFile) {
    const fd = new FormData();

    if (body.sku) fd.append("sku", body.sku);
    fd.append("name", body.name ?? "");
    fd.append("price", String(toNum(body.price)));
    fd.append("stock", String(normalizedStock));
    if (body.description != null) fd.append("description", body.description);
    if (body.category_id != null) fd.append("category_id", String(body.category_id));
    if (body.sub_category_id != null) fd.append("sub_category_id", String(body.sub_category_id));

    // ✅ WAJIB: inventory_type
    fd.append("inventory_type", inventory_type);

    // unit_id (kalau ada)
    if (body.unit_id != null && String(body.unit_id) !== "") {
      fd.append("unit_id", String(body.unit_id));
    }

    fd.append("image", body.image);

    // opsional (admin-only)
    if (body.scope) fd.append("scope", body.scope);
    if (body.store_location_id != null) fd.append("store_location_id", String(body.store_location_id));

    // opsional: kalau BE kamu masih nerima flag lama
    if (body.is_stock_tracked != null) fd.append("is_stock_tracked", String(Number(body.is_stock_tracked)));

    const { data } = await api.post("/api/products", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      signal,
    });
    return data?.data || data;
  }

  // JSON biasa
  const payload = {
    name: body.name ?? "",
    price: toNum(body.price),
    stock: normalizedStock,
    sku: body.sku ?? "",
    description: toNull(body.description),
    category_id: body.category_id ?? null,
    sub_category_id: body.sub_category_id ?? null,

    // ✅ WAJIB: inventory_type
    inventory_type,

    // unit_id
    unit_id:
      body.unit_id === "" || body.unit_id === undefined || body.unit_id === null
        ? null
        : Number(body.unit_id),

    // opsional (admin-only)
    ...(body.scope ? { scope: body.scope } : {}),
    ...(body.store_location_id != null ? { store_location_id: body.store_location_id } : {}),

    // opsional: flag lama (biar backward compatible)
    ...(body.is_stock_tracked != null ? { is_stock_tracked: Number(body.is_stock_tracked) } : {}),
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

// Create + upload banyak gambar
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
 */
export async function updateProduct(id, body = {}, signal) {
  if (!id) throw new Error("Missing product id");

  const inventory_type = resolveInventoryType(body);
  const normalizedStock = inventory_type === "stock" ? toNum(body.stock) : 0;

  const payload = {
    name: body.name ?? "",
    price: toNum(body.price),
    stock: normalizedStock,
    sku: body.sku ?? "",
    description: toNull(body.description),
    category_id: body.category_id ? Number(body.category_id) : null,
    sub_category_id: body.sub_category_id ? Number(body.sub_category_id) : null,

    // ✅ WAJIB: inventory_type (biar lolos UpdateProductRequest kamu)
    inventory_type,

    // unit_id
    unit_id:
      body.unit_id === "" || body.unit_id === undefined || body.unit_id === null
        ? null
        : Number(body.unit_id),

    // opsional (admin-only)
    ...(body.scope ? { scope: body.scope } : {}),
    ...(body.store_location_id != null ? { store_location_id: Number(body.store_location_id) } : {}),

    // opsional: flag lama
    ...(body.is_stock_tracked != null ? { is_stock_tracked: Number(body.is_stock_tracked) } : {}),
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
