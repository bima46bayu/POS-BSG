import { api } from "./client";

export async function listActivityLogs(params = {}, signal) {
  const { data } = await api.get("/api/activity-logs", { params, signal });
  return data;
}
