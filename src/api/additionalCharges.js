import { api } from "./client";

export const listAdditionalCharges = (params, signal) =>
  api.get("/api/additional-charges", { params, signal });

export const createAdditionalCharge = (payload) =>
  api.post("/api/additional-charges", payload);

export const updateAdditionalCharge = (id, payload) =>
  api.put(`/api/additional-charges/${id}`, payload);

export const deleteAdditionalCharge = (id) =>
  api.delete(`/api/additional-charges/${id}`);