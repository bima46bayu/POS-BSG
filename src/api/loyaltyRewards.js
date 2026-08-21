import { api } from "./client";
import { unwrapPaginated } from "../lib/paginate";

export async function listLoyaltyRewards(params = {}, signal) {
  const { data } = await api.get("/api/loyalty-rewards", { params, signal });
  return unwrapPaginated(data, params);
}

export async function createLoyaltyReward(payload) {
  const { data } = await api.post("/api/loyalty-rewards", payload);
  return data;
}

export async function updateLoyaltyReward(id, payload) {
  const { data } = await api.put(`/api/loyalty-rewards/${id}`, payload);
  return data;
}

export async function deleteLoyaltyReward(id) {
  const { data } = await api.delete(`/api/loyalty-rewards/${id}`);
  return data;
}

export async function redeemLoyaltyReward(id, payload) {
  const { data } = await api.post(`/api/loyalty-rewards/${id}/redeem`, payload);
  return data;
}
