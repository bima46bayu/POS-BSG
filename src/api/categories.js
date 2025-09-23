import { api } from "./client";

const unwrap = (data) => (Array.isArray(data) ? data : data?.data || []);

export async function getCategories() {
  const { data } = await api.get("/api/categories");
  return unwrap(data); // [{id,name}]
}

export async function getSubCategories(category_id) {
  const { data } = await api.get("/api/sub-categories", { params: { category_id } });
  return unwrap(data); // [{id,name,category_id}]
}

// src/api/categories.js
export function listCategories(params = { per_page: 100 }) {
  return api.get("/api/categories", { params });
}

