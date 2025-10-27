import { api } from "./client";

const N = (v, fb = 0) => (v == null || v === "" ? fb : Number(v));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function normalizeListResponse(d, params = {}) {
  const reqPer = N(params.per_page ?? params.limit, 10);
  const reqPage = N(params.page, 1);

  // 1) array murni
  if (Array.isArray(d)) {
    const total = d.length;
    const per = total || Math.max(1, reqPer || 10);
    const out = {
      items: d,
      meta: { current_page: 1, per_page: per, last_page: 1, total },
      links: { next: null, prev: null },
    };
    return { ...out, data: out.items, raw: d };
  }

  const calcMeta = (items, rawMeta = {}, rawFlat = {}) => {
    const per =
      N(rawMeta.per_page, N(rawFlat.per_page, (items && items.length) || reqPer || 10)) || 10;

    const total = N(
      rawMeta.total,
      N(rawFlat.total, Array.isArray(items) ? items.length : 0)
    );

    const computedLast = Math.max(1, Math.ceil(total / Math.max(1, per)));

    const pageFromRaw =
      N(rawMeta.current_page, N(rawFlat.current_page, N(rawFlat.page, 1)));
    const requestedPage = reqPage || pageFromRaw || 1;

    const last_page =
      N(rawMeta.last_page, N(rawFlat.last_page, computedLast)) || computedLast;
    const final_last = Math.max(1, last_page);

    const current_page = clamp(requestedPage, 1, final_last);

    // kalau request page kelewatan, kosongkan items supaya UI pindah halaman valid
    const final_items = requestedPage > final_last ? [] : items;

    const links =
      rawFlat.links ??
      rawMeta.links ?? {
        next: rawFlat.next_page_url ?? rawMeta.next_page_url ?? null,
        prev: rawFlat.prev_page_url ?? rawMeta.prev_page_url ?? null,
      };

    return {
      items: final_items,
      meta: {
        current_page,
        per_page: per,
        last_page: final_last,
        total,
        requested_page: requestedPage, // info debug opsional
      },
      links,
    };
  };

  // 2) laravel paginator default (root fields: data, total, per_page, current_page, last_page, ...)
  if (d && typeof d === "object" && Array.isArray(d.data)) {
    const out = calcMeta(d.data, {}, d);
    return { ...out, data: out.items, raw: d };
  }

  // 3) sudah { items, meta }
  if (d && Array.isArray(d.items) && d.meta) {
    const out = calcMeta(d.items, d.meta, d);
    return { ...out, data: out.items, raw: d };
  }

  // 4) fallback (punya .data tapi bukan paginator lengkap)
  const arr = Array.isArray(d?.data) ? d.data : [];
  const out = calcMeta(arr, {}, d || {});
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
