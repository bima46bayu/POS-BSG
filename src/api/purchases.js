import { api } from "./client";

// PURCHASE (PO)
export const listPurchases = (params) =>
  api.get("/api/purchases", { params }).then(r => r.data);

export const getPurchase = (id) =>
  api.get(`/api/purchases/${id}`).then(r => r.data);

export const createPurchase = (payload) =>
  api.post("/api/purchases", payload).then(r => r.data);

export const approvePurchase = (id) =>
  api.post(`/api/purchases/${id}/approve`).then(r => r.data);

export const cancelPurchase = (id) =>
  api.post(`/api/purchases/${id}/cancel`).then(r => r.data);

// GOODS RECEIPT (GR)
export const getForReceipt = (id) =>
  api.get(`/api/purchases/${id}/for-receipt`).then(r => r.data);

export const createReceipt = (purchaseId, payload) =>
  api.post(`/api/purchases/${purchaseId}/receive`, payload).then(r => r.data);

export const listReceipts = (params) =>
  api.get("/api/receipts", { params }).then(r => r.data);

export const getReceipt = (id) =>
  api.get(`/api/receipts/${id}`).then(r => r.data);
