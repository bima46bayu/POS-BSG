import { api } from "./client";

export const listProductRecipes = (params, signal) =>
  api.get("/api/product-recipes", { params, signal });

export const createProductRecipe = (payload) =>
  api.post("/api/product-recipes", payload);

export const updateProductRecipe = (id, payload) =>
  api.put(`/api/product-recipes/${id}`, payload);

export const deleteProductRecipe = (id) =>
  api.delete(`/api/product-recipes/${id}`);
