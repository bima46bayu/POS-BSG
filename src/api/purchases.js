import { api } from "./client";

const N = (v, fb = 0) => (v == null ? fb : Number(v));

function normalizeListResponse(d, params = {}) {
  // 1) array murni
  if (Array.isArray(d)) {
    const total = d.length;
    const out = {
      items: d,
      meta: { current_page: 1, per_page: total, last_page: 1, total },
      links: { next: null, prev: null },
    };
    // kompat: sediakan "data" juga
    return { ...out, data: out.items, raw: d };
  }

  // 2) laravel paginator default (root fields)
  if (d && typeof d === "object" && Array.isArray(d.data)) {
    const per = N(d.per_page, d.data.length || N(params.per_page, 10));
    const total = N(d.total, d.data.length);
    const last = d.last_page != null ? N(d.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
    const out = {
      items: d.data,
      meta: { current_page: N(d.current_page, 1), per_page: per, last_page: last, total },
      links: { next: d.next_page_url ?? null, prev: d.prev_page_url ?? null },
    };
    return { ...out, data: out.items, raw: d };
  }

  // 3) sudah { items, meta }
  if (d && Array.isArray(d.items) && d.meta) {
    const per = N(d.meta.per_page, d.items.length || N(params.per_page, 10));
    const total = N(d.meta.total, d.items.length);
    const last = d.meta.last_page != null ? N(d.meta.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
    const out = {
      items: d.items,
      meta: { current_page: N(d.meta.current_page, 1), per_page: per, last_page: last, total },
      links: d.links ?? { next: null, prev: null },
    };
    return { ...out, data: out.items, raw: d };
  }

  // 4) fallback
  const arr = Array.isArray(d?.data) ? d.data : [];
  const per = N(d?.per_page, N(params.per_page, 10));
  const total = N(d?.total, arr.length);
  const last = d?.last_page != null ? N(d.last_page, 1) : Math.max(1, Math.ceil(total / Math.max(1, per)));
  const out = {
    items: arr,
    meta: { current_page: N(d?.current_page, 1), per_page: per, last_page: last, total },
    links: { next: d?.next_page_url ?? null, prev: d?.prev_page_url ?? null },
  };
  return { ...out, data: out.items, raw: d };
}

/* ===================== PURCHASE (PO) ===================== */

export const listPurchases = async (params = {}, signal) => {
  const { data } = await api.get("/api/purchases", { params, signal });
  return normalizeListResponse(data, params);
};

export const getPurchase = async (id, signal) => {
  const { data } = await api.get(`/api/purchases/${id}`, { signal });
  return data?.data ?? data;
};

export const createPurchase = async (payload, signal) => {
  const { data } = await api.post("/api/purchases", payload, { signal });
  return data;
};

export const approvePurchase = async (id, signal) => {
  const { data } = await api.post(`/api/purchases/${id}/approve`, null, { signal });
  return data;
};

export const cancelPurchase = async (id, signal) => {
  const { data } = await api.post(`/api/purchases/${id}/cancel`, null, { signal });
  return data;
};

/* ===================== GOODS RECEIPT (GR) ===================== */

export const getForReceipt = async (id, signal) => {
  const { data } = await api.get(`/api/purchases/${id}/for-receipt`, { signal });
  return data?.data ?? data;
};

export const createReceipt = async (purchaseId, payload, signal) => {
  const { data } = await api.post(`/api/purchases/${purchaseId}/receive`, payload, { signal });
  return data;
};

export const listReceipts = async (params = {}, signal) => {
  const { data } = await api.get("/api/receipts", { params, signal });
  return normalizeListResponse(data, params);
};

export const getReceipt = async (id, signal) => {
  const { data } = await api.get(`/api/receipts/${id}`, { signal });
  return data?.data ?? data;
};
