import { api } from "./client";

/** Full settings payload: signers list + role assignments + resolved PDF preview */
export async function getPaymentRequestSignatories(signal) {
  const { data } = await api.get("/api/settings/payment-request-signatories", {
    signal,
  });
  return data;
}

export async function updatePaymentRequestSignerRoles(roles) {
  const { data } = await api.put("/api/settings/payment-request-signatories", {
    roles,
  });
  return data;
}

export async function listPaymentRequestSigners(params = {}, signal) {
  const { data } = await api.get("/api/settings/payment-request-signers", {
    params,
    signal,
  });
  return data?.data ?? data ?? [];
}

export async function createPaymentRequestSigner(payload) {
  const { data } = await api.post("/api/settings/payment-request-signers", payload);
  return data;
}

export async function updatePaymentRequestSigner(id, payload) {
  const { data } = await api.put(
    `/api/settings/payment-request-signers/${id}`,
    payload
  );
  return data;
}

export async function deletePaymentRequestSigner(id) {
  await api.delete(`/api/settings/payment-request-signers/${id}`);
}

export async function uploadPaymentRequestSignature(file, { signerId, role } = {}) {
  const form = new FormData();
  form.append("file", file);
  if (signerId) form.append("signer_id", String(signerId));
  if (role) form.append("role", role);
  const { data } = await api.post(
    "/api/settings/payment-request-signatories/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function getVoidSecurityCodeStatus(params = {}, signal) {
  const { data } = await api.get("/api/settings/void-security-code", {
    params,
    signal,
  });
  return data;
}

export async function updateVoidSecurityCode(securityCode, storeLocationId) {
  const { data } = await api.put("/api/settings/void-security-code", {
    store_location_id: storeLocationId,
    security_code: securityCode,
    security_code_confirmation: securityCode,
  });
  return data;
}
