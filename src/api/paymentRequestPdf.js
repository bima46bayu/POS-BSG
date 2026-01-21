import { api } from "./client";

export async function getPaymentRequestPdfLink(id) {
  const res = await api.get(`/api/payment-requests/${id}/pdf-link`);
  return res.data.pdf_url;
}
