// =============================
// src/api/masters.js
// =============================
import { api } from "./client";

// GET Suppliers (list) — konsisten dengan pola /api/... yang kamu pakai di products.js
export const listSuppliers = (params = {}, signal) =>
  api.get("/api/suppliers", { params, signal }).then((r) => r.data);
