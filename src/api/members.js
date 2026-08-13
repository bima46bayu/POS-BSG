import { api } from "./client";

/**
 * Member / customer database + loyalty points.
 *
 * Members belong to a PARENT store group, so a card made at one branch works at
 * every branch of the same parent. The backend resolves that from
 * store_location_id — the client just passes the branch it is working in.
 */

/* ================= CRUD (Master page) ================= */

/** Paginated list. Returns the raw Laravel paginator so the UI can page. */
export async function listMembers(params, signal) {
  const { data } = await api.get("/api/members", { params, signal });

  return {
    items: data?.data ?? [],
    total: data?.total ?? 0,
    currentPage: data?.current_page ?? 1,
    lastPage: data?.last_page ?? 1,
    perPage: data?.per_page ?? 25,
  };
}

export async function getMember(id, signal) {
  const { data } = await api.get(`/api/members/${id}`, { signal });

  return {
    member: data?.data ?? data,
    pointTransactions: data?.point_transactions ?? [],
  };
}

export async function nextMemberCode(params, signal) {
  const { data } = await api.get("/api/members/next-code", { params, signal });
  return data?.code ?? "";
}

export async function createMember(payload) {
  const { data } = await api.post("/api/members", payload);
  return data?.data ?? data;
}

export async function updateMember(id, payload) {
  const { data } = await api.put(`/api/members/${id}`, payload);
  return data?.data ?? data;
}

export const deleteMember = (id) => api.delete(`/api/members/${id}`);

/* ================= Points ================= */

/** Manual correction. `points` may be negative. */
export async function adjustMemberPoints(id, points, note) {
  const { data } = await api.post(`/api/members/${id}/points`, { points, note });
  return data?.data ?? data;
}

export async function listMemberPointHistory(id, params, signal) {
  const { data } = await api.get(`/api/members/${id}/points`, {
    params,
    signal,
  });

  return {
    items: data?.data ?? [],
    total: data?.total ?? 0,
    currentPage: data?.current_page ?? 1,
    lastPage: data?.last_page ?? 1,
  };
}

/* ================= POS lookup ================= */

/**
 * Cashier-facing search (phone / name / code). Cheap and capped server-side.
 * Empty search returns recent customers, which is what a cashier usually wants.
 */
export async function lookupMembers(params, signal) {
  const { data } = await api.get("/api/members/lookup", { params, signal });

  return {
    items: data?.data ?? [],
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
