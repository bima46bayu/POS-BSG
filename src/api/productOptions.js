import { api } from "./client";

/**
 * Product option groups (Sugar Level, Ice Level, dst.)
 * Group punya banyak values: { id, name, price_delta, is_active, sort_order }
 */

export async function listProductOptionGroups(params, signal) {
  const { data } = await api.get("/api/product-option-groups", {
    params,
    signal,
  });
  return data?.data ?? data?.items ?? [];
}

export async function getProductOptionGroup(id, signal) {
  const { data } = await api.get(`/api/product-option-groups/${id}`, {
    signal,
  });
  return data?.data ?? data;
}

export async function createProductOptionGroup(payload) {
  const { data } = await api.post("/api/product-option-groups", payload);
  return data?.data ?? data;
}

export async function updateProductOptionGroup(id, payload) {
  const { data } = await api.put(`/api/product-option-groups/${id}`, payload);
  return data?.data ?? data;
}

export const deleteProductOptionGroup = (id) =>
  api.delete(`/api/product-option-groups/${id}`);

/* ============ assign produk dari sisi grup (Master) ============ */

/**
 * Produk yang bisa dipasangi grup ini + flag is_attached.
 * → { items, attachedIds }
 */
export async function listOptionGroupProducts(id, params, signal) {
  const { data } = await api.get(`/api/product-option-groups/${id}/products`, {
    params,
    signal,
  });

  return {
    items: data?.data ?? [],
    attachedIds: (data?.attached_ids ?? []).map(Number),
  };
}

/** Sync penuh: produk di luar list akan dilepas dari grup. */
export async function syncOptionGroupProducts(id, productIds) {
  const { data } = await api.put(
    `/api/product-option-groups/${id}/products`,
    { product_ids: (productIds || []).map(Number) }
  );
  return data?.data ?? data;
}

/* ================= helpers dipakai POS ================= */

/**
 * Normalisasi option groups dari payload produk.
 * Backend mengirim `option_groups` (relasi) berisi `values`.
 */
export function normalizeOptionGroups(product) {
  const raw = product?.option_groups ?? product?.optionGroups ?? [];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((g) => g && g.is_active !== false)
    .map((g) => ({
      id: g.id,
      name: g.name || "",
      selection_type: g.selection_type === "MULTI" ? "MULTI" : "SINGLE",
      is_required: !!g.is_required,
      sort_order: Number(g.sort_order ?? 0),
      values: (g.values || [])
        .filter((v) => v && v.is_active !== false)
        .map((v) => ({
          id: v.id,
          name: v.name || "",
          price_delta: Number(v.price_delta ?? 0),
          sort_order: Number(v.sort_order ?? 0),
        }))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    }))
    .filter((g) => g.values.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

/** Total tambahan harga per unit dari opsi terpilih. */
export function sumOptionsPrice(selected) {
  return (selected || []).reduce(
    (acc, o) => acc + Number(o.price_delta ?? 0),
    0
  );
}

/**
 * Key unik untuk baris cart: produk yang sama tapi opsi berbeda
 * harus jadi baris terpisah.
 */
export function buildCartLineKey(productId, selected) {
  const ids = (selected || [])
    .map((o) => Number(o.value_id ?? o.id))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  return ids.length ? `${productId}::${ids.join("-")}` : `${productId}`;
}

/**
 * Label for cart / receipt.
 * Paid add-ons are shown next to the name so the customer sees why the line
 * price is higher, e.g. `More Ice (+Rp2.000), Less Sugar`.
 */
export function formatOptionsLabel(selected) {
  return (selected || [])
    .map((o) => {
      const name = (o?.name || "").toString().trim();
      if (!name) return "";

      const delta = Number(o?.price_delta ?? 0);
      if (!Number.isFinite(delta) || delta === 0) return name;

      const signed = `${delta > 0 ? "+" : "-"}Rp${Math.abs(delta).toLocaleString("id-ID")}`;
      return `${name} (${signed})`;
    })
    .filter(Boolean)
    .join(", ");
}
