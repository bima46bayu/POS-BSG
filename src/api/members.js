import { api } from "./client";
import { unwrapItem, unwrapPaginated } from "../lib/paginate";

/**
 * Member / customer database + loyalty points.
 *
 * Members are company-wide: one card and one point balance at every outlet.
 * store_location_id on create is only where they registered.
 */

/* ================= CRUD (Master page) ================= */

/** Paginated list, exposed to the UI in camelCase. */
export async function listMembers(params, signal) {
  const { data } = await api.get("/api/members", { params, signal });
  const { items, meta } = unwrapPaginated(data, params);

  return {
    items,
    total: meta.total,
    currentPage: meta.current_page,
    lastPage: meta.last_page,
    perPage: meta.per_page,
  };
}

export async function getMember(id, signal) {
  const { data } = await api.get(`/api/members/${id}`, { signal });

  return {
    member: unwrapItem(data),
    pointTransactions: data?.point_transactions ?? [],
  };
}

export async function nextMemberCode(params, signal) {
  const { data } = await api.get("/api/members/next-code", { params, signal });
  return data?.code ?? "";
}

export async function createMember(payload) {
  const { data } = await api.post("/api/members", payload);
  return unwrapItem(data);
}

export async function updateMember(id, payload) {
  const { data } = await api.put(`/api/members/${id}`, payload);
  return unwrapItem(data);
}

export const deleteMember = (id) => api.delete(`/api/members/${id}`);

/* ================= Points ================= */

/** Manual correction. `points` may be negative. */
export async function adjustMemberPoints(id, points, note) {
  const { data } = await api.post(`/api/members/${id}/points`, { points, note });
  return unwrapItem(data);
}

export async function listMemberPointHistory(id, params, signal) {
  const { data } = await api.get(`/api/members/${id}/points`, {
    params,
    signal,
  });

  const { items, meta } = unwrapPaginated(data, params);

  return {
    items,
    total: meta.total,
    currentPage: meta.current_page,
    lastPage: meta.last_page,
  };
}

/* ================= POS lookup ================= */

/**
 * Cashier-facing search (phone / name / code). Cheap and capped server-side.
 * Empty search returns recent customers, which is what a cashier usually wants.
 */
export async function lookupMembers(params, signal) {
  const { data } = await api.get("/api/members/lookup", { params, signal });

  // `rate` and `enabled` are siblings of `data`, not pagination metadata.
  return {
    items: unwrapPaginated(data).items,
    rate: Number(data?.rate ?? 0),
    enabled: data?.enabled !== false,
  };
}

/* ================= Point conversion settings ================= */

export async function getPointSettings(signal) {
  const { data } = await api.get("/api/members/settings/points", { signal });
  return data;
}

/** `points_per_amount` = rupiah needed for 1 point. */
export async function updatePointSettings(payload) {
  const { data } = await api.put("/api/members/settings/points", payload);
  return data;
}

/* ================= helpers ================= */

/** Points a given spend would earn at `rate`. Mirrors LoyaltyService::pointsFor. */
export function pointsForAmount(amount, rate) {
  const amt = Number(amount || 0);
  const r = Number(rate || 0);
  if (amt <= 0 || r <= 0) return 0;

  return Math.floor(amt / r);
}
