// src/lib/aggregate.js
import { N, dayKey, generateDateRange, isDiscountSale } from "./fmt";

/* =========================
   Helper hitung diskon item
   ========================= */
function getItemDiscount(it) {
  // 1. Diskon eksplisit nominal
  if (Number(it?.discount_nominal) > 0) return Number(it.discount_nominal);

  const qty = Number(it?.qty ?? it?.quantity ?? 1);
  const unit = Number(it?.unit_price ?? it?.price ?? 0);
  const net  = Number(it?.net_unit_price ?? unit);

  // 2. Selisih unit vs net
  if (unit > net) return (unit - net) * qty;

  // 3. Fallback subtotal vs normal
  const subtotal = Number(it?.subtotal ?? it?.line_total ?? qty * unit);
  const normal = qty * unit;
  if (normal > subtotal) return normal - subtotal;

  return 0;
}

export function aggregateForRange(sales, from, to, categoriesMap, subCategoriesMap) {
  let revenue = 0, tx = 0, discounts = 0;
  const byDate = {};
  const byDateTotal = {};
  const payMix = {};
  const byProduct = {};
  const byProductDiscounted = {};
  const byCategoryStats = {};
  const bySubCategory = {};

  const allDates = generateDateRange(from, to);
  allDates.forEach((date) => {
    byDate[date] = { date, discount: 0, non_discount: 0 };
    byDateTotal[date] = { date, total: 0 };
  });

  for (const s of sales) {
    if (String(s?.status || "").toLowerCase() === "void") continue;

    const total = N(s?.total);
    const dKey = dayKey(s?.created_at || Date.now());
    const itemsArr = Array.isArray(s?.items) ? s.items : [];

    revenue += total;
    tx += 1;

    /* =========================
       DISKON HEADER + ITEM
       ========================= */
    let saleDiscount = N(s?.discount);

    for (const it of itemsArr) {
      saleDiscount += getItemDiscount(it);
    }

    discounts += saleDiscount;

    /* =========================
       Trend harian diskon
       ========================= */
    if (byDate[dKey]) {
      if (saleDiscount > 0) byDate[dKey].discount += total;
      else byDate[dKey].non_discount += total;
    }
    if (byDateTotal[dKey]) byDateTotal[dKey].total += total;

    /* =========================
       Payment mix
       ========================= */
    const pays = Array.isArray(s?.payments) ? s.payments : [];
    if (pays.length === 0) payMix["Cash"] = (payMix["Cash"] || 0) + total;
    else {
      for (const p of pays) {
        const method = p?.method || "Cash";
        payMix[method] = (payMix[method] || 0) + N(p?.amount);
      }
    }

    /* =========================
       Item loop
       ========================= */
    for (const it of itemsArr) {
      const product = it?.product || {};
      const categoryId = product?.category_id || null;
      const subCategoryId = product?.sub_category_id || null;

      const categoryName = categoryId && categoriesMap[categoryId]
        ? categoriesMap[categoryId].name : "Uncategorized";
      const subCategoryName = subCategoryId && subCategoriesMap[subCategoryId]
        ? subCategoriesMap[subCategoryId].name : "Other";

      const productName = product?.name || it?.name || `Product #${it?.product_id ?? "?"}`;
      const qty = N(it?.qty ?? it?.quantity ?? 1);
      const lineTotal = N(it?.line_total ?? it?.subtotal ?? N(it?.price) * qty);

      // Category stats
      byCategoryStats[categoryName] ||= { name: categoryName, qty: 0, revenue: 0, tx: new Set() };
      byCategoryStats[categoryName].qty += qty;
      byCategoryStats[categoryName].revenue += lineTotal;
      byCategoryStats[categoryName].tx.add(s.id);

      // Subcategory
      const subKey = `${categoryName}::${subCategoryName}`;
      bySubCategory[subKey] ||= { category: categoryName, subCategory: subCategoryName, qty: 0, revenue: 0, tx: new Set() };
      bySubCategory[subKey].qty += qty;
      bySubCategory[subKey].revenue += lineTotal;
      bySubCategory[subKey].tx.add(s.id);

      // Product
      byProduct[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0 };
      byProduct[productName].qty += qty;
      byProduct[productName].revenue += lineTotal;

      // Discounted product
      if (getItemDiscount(it) > 0 || saleDiscount > 0) {
        byProductDiscounted[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0, used: 0 };
        byProductDiscounted[productName].qty += qty;
        byProductDiscounted[productName].revenue += lineTotal;
        byProductDiscounted[productName].used += 1;
      }
    }
  }

  const aov = tx ? revenue / tx : 0;
  const discountRate = tx ? Object.values(byDate).reduce((a, d) => a + (d.discount > 0 ? 1 : 0), 0) / tx : 0;

  const trendStacked = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const trendTotal = Object.values(byDateTotal).sort((a, b) => a.date.localeCompare(b.date));
  const paymentMix = Object.entries(payMix).map(([method, amount]) => ({ method, amount }));
  const categoryPie = Object.values(byCategoryStats).map((c) => ({ category: c.name, amount: c.revenue }));

  const topProducts = Object.values(byProduct)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map((p) => ({ ...p, share: revenue ? (p.revenue / revenue) * 100 : 0 }));

  const topDiscountedProducts = Object.values(byProductDiscounted)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map((p) => ({ ...p, discount_used: tx ? (p.used / tx) * 100 : 0 }));

  const topCategories = Object.values(byCategoryStats)
    .map((c) => ({ ...c, txCount: c.tx.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((c) => ({ ...c, share: revenue ? (c.revenue / revenue) * 100 : 0 }));

  const topSubCategories = Object.values(bySubCategory)
    .map((c) => ({ ...c, txCount: c.tx.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  const recentSales = [...sales]
    .filter((s) => String(s?.status || "").toLowerCase() !== "void")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 10);

  return {
    revenue,
    tx,
    discounts,
    aov,
    discountRate,
    trendStacked,
    trendTotal,
    paymentMix,
    categoryPie,
    topProducts,
    topDiscountedProducts,
    topCategories,
    topSubCategories,
    recentSales,
  };
}
