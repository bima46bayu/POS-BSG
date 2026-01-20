import { api } from "./client";

export async function getPaymentRequests(params = {}, signal) {
  const res = await api.get("/api/payment-requests", { params, signal });

  const raw = res.data;

  // Normalisasi data rows
  let data = [];
  if (Array.isArray(raw?.data)) data = raw.data;
  else if (Array.isArray(raw?.items)) data = raw.items;
  else if (Array.isArray(raw)) data = raw;

  // Normalisasi meta pagination
  let meta = raw?.meta;

  if (!meta && raw?.pagination) {
    meta = {
      current_page: raw.pagination.page,
      last_page: raw.pagination.total_pages,
      per_page: raw.pagination.per_page,
      total: raw.pagination.total,
    };
  }

  if (!meta) {
    meta = {
      current_page: params.page || 1,
      last_page: 1,
      per_page: params.per_page || data.length,
      total: data.length,
    };
  }

  return { data, meta };
}


export async function createPaymentRequest(payload, signal) {
  const { data } = await api.post("api/payment-requests", payload, { signal });
  return data;
}

export async function deletePaymentRequest(id, signal) {
  const { data } = await api.delete(`api/payment-requests/${id}`, { signal });
  return data;
}

export async function getPaymentRequestDetail(id, signal) {
  const { data } = await api.get(`api/payment-requests/${id}`, { signal });
  return data;
}