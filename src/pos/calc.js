const toNum = (v) => Number(v || 0);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const r2 = (n) => Math.round(n * 100) / 100;

export const money = (n) => `Rp${toNum(n).toLocaleString('id-ID')}`;

export function discountNominalPerUnit(price, type = '%', value = 0) {
  const p = toNum(price), v = toNum(value);
  return type === '%' ? r2(p * clamp(v, 0, 100) / 100) : r2(clamp(v, 0, p));
}
export function netUnit(price, type, value) {
  return r2(Math.max(0, toNum(price) - discountNominalPerUnit(price, type, value)));
}
export function lineTotal(item) {
  const net = netUnit(item.price, item.discount_type, item.discount_value);
  return r2(net * toNum(item.quantity));
}

export function subtotalItems(items = []) {
  return r2(items.reduce((s, it) => s + lineTotal(it), 0));
}
export function taxAmount(base, { mode = 'percent', value = 0 }) {
  const b = toNum(base);
  return mode === 'percent' ? r2(b * (toNum(value) / 100)) : r2(toNum(value));
}
export function grandTotal({ items, headerDiscount = 0, serviceCharge = 0, taxConf }) {
  const sub = subtotalItems(items);
  const afterDiscount = Math.max(0, sub - toNum(headerDiscount));
  const afterService = afterDiscount + toNum(serviceCharge);
  const tax = taxAmount(afterService, taxConf || { mode: 'percent', value: 0 });
  return { sub, tax, total: r2(afterService + tax) };
}

export function mapItemsForApi(items = []) {
  return items.map((it) => ({
    product_id: it.product_id ?? it.id,
    qty: toNum(it.quantity),
    unit_price: r2(toNum(it.price)),
    discount_nominal: discountNominalPerUnit(it.price, it.discount_type, it.discount_value),
  }));
}
