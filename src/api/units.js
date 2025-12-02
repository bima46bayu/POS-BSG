// src/api/units.js
import { api } from "./client";

/**
 * GET /api/units
 * Optional params: { search, page, per_page }
 */
export async function listUnits(params = {}) {
  const res = await api.get("/api/units", { params });

  // Sesuaikan dengan pola response BE kamu:
  // - { data: [...] }
  // - atau langsung array
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.items)) return res.data.items;
  return [];
}

/**
 * POST /api/units
 * payload: { name: string }
 */
export async function createUnit(payload) {
  const res = await api.post("/api/units", payload);
  return res.data; // balikannya bebas, yg penting ada id & name
}

/**
 * PUT /api/units/{id}
 * payload: { name: string }
 */
export async function updateUnit(id, payload) {
  const res = await api.put(`/api/units/${id}`, payload);
  return res.data;
}

/**
 * DELETE /api/units/{id}
 */
export async function deleteUnit(id) {
  const res = await api.delete(`/api/units/${id}`);
  return res.data;
}
