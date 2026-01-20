import { api } from "./client";

export async function createPaymentRequestBalance(prId, payload) {
  const { data } = await api.post(
    `/api/payment-requests/${prId}/balances`,
    payload
  );
  return data;
}

export async function updatePaymentRequestBalance(prId, balanceId, payload) {
  const { data } = await api.put(
    `/api/payment-requests/${prId}/balances/${balanceId}`,
    payload
  );
  return data;
}

export async function deletePaymentRequestBalance(prId, balanceId) {
  const { data } = await api.delete(
    `/api/payment-requests/${prId}/balances/${balanceId}`
  );
  return data;
}
