import { api } from "./client";

export async function createPaymentRequestItem(prId, payload) {
  const { data } = await api.post(
    `/api/payment-requests/${prId}/items`,
    payload
  );
  return data;
}

export async function updatePaymentRequestItem(prId, itemId, payload) {
  const { data } = await api.put(
    `/api/payment-requests/${prId}/items/${itemId}`,
    payload
  );
  return data;
}

export async function deletePaymentRequestItem(prId, itemId) {
  const { data } = await api.delete(
    `/api/payment-requests/${prId}/items/${itemId}`
  );
  return data;
}
