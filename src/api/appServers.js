import { api } from "./client";

export const listAppServers = (signal) =>
  api.get("/api/app-servers/manage", { signal });

export const createAppServer = (payload) =>
  api.post("/api/app-servers", payload);

export const updateAppServer = (id, payload) =>
  api.put(`/api/app-servers/${id}`, payload);

export const deleteAppServer = (id) =>
  api.delete(`/api/app-servers/${id}`);
