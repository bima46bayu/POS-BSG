import { api } from "./client";

export function openPaymentRequestPdf(prId) {
  const url = `${api.defaults.baseURL}/api/payment-requests/${prId}/pdf`;
  window.open(url, "_blank");
}
