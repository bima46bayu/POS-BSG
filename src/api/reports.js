import { api } from "./client";

// respons fleksibel: { items, meta } | { data, meta } | []
const unwrapList = (res) => {
  const data = res?.data ?? res;
  const items = data?.items ?? data?.data ?? data ?? [];
  const meta  = data?.meta ?? null;
  return { items: Array.isArray(items) ? items : [], meta };
};

// GET /api/reports/sales-items
export async function listSaleItems(params = {}, signal) {
  const { data } = await api.get("/api/reports/sales-items", { params, signal });
  return unwrapList(data);
}
