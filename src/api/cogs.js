import { api } from "./client";

export async function fetchCogsPerSku(params = {}, signal) {
  const { data } = await api.get("/api/reports/cogs-per-sku", { params, signal });
  return (
    data || {
      items: [],
      totals: {
        sku_count: 0,
        qty_sold: 0,
        revenue: 0,
        cogs: 0,
        gross_profit: 0,
        missing_cost_count: 0,
      },
    }
  );
}
