/**
 * Customer type (General / Retail / Member / ...) plus optional person name.
 * `customer_name` on a sale is the type; `buyer_name` is who the order is for.
 */
export function formatCustomerLabel(type, buyerName) {
  const t = String(type || "").trim() || "General";
  const name = String(buyerName || "").trim();
  return name ? `${t} · ${name}` : t;
}

export function saleCustomerLabel(sale) {
  if (!sale) return "General";
  if (sale.customer_label) return sale.customer_label;
  return formatCustomerLabel(sale.customer_name, sale.buyer_name);
}
