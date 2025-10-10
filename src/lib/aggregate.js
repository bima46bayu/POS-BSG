// src/lib/aggregate.js
import { N, dayKey, generateDateRange, isDiscountSale } from "./fmt";

export function aggregateForRange(sales, from, to, categoriesMap, subCategoriesMap) {
  let revenue = 0, tx = 0, discounts = 0;
  const byDate = {};
  const byDateTotal = {};
  const byCategory = {};
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
    discounts += N(s?.discount);

    if (byDate[dKey]) {
      if (isDiscountSale(s)) byDate[dKey].discount += total;
      else byDate[dKey].non_discount += total;
    }
    if (byDateTotal[dKey]) byDateTotal[dKey].total += total;

    const pays = Array.isArray(s?.payments) ? s.payments : [];
    if (pays.length === 0) payMix["Cash"] = (payMix["Cash"] || 0) + total;
    else for (const p of pays) {
      const method = p?.method || "Cash";
      payMix[method] = (payMix[method] || 0) + N(p?.amount);
    }

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

      byCategoryStats[categoryName] ||= { name: categoryName, qty: 0, revenue: 0, tx: new Set() };
      byCategoryStats[categoryName].qty += qty;
      byCategoryStats[categoryName].revenue += lineTotal;
      byCategoryStats[categoryName].tx.add(s.id);

      const subKey = `${categoryName}::${subCategoryName}`;
      bySubCategory[subKey] ||= { category: categoryName, subCategory: subCategoryName, qty: 0, revenue: 0, tx: new Set() };
      bySubCategory[subKey].qty += qty;
      bySubCategory[subKey].revenue += lineTotal;
      bySubCategory[subKey].tx.add(s.id);

      byProduct[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0 };
      byProduct[productName].qty += qty;
      byProduct[productName].revenue += lineTotal;

      if (isDiscountSale(s)) {
        byProductDiscounted[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0, used: 0 };
        byProductDiscounted[productName].qty += qty;
        byProductDiscounted[productName].revenue += lineTotal;
        byProductDiscounted[productName].used += 1;
      }
    }
  }

  const aov = tx ? revenue / tx : 0;
  const discountRate = tx ? sales.filter(isDiscountSale).length / tx : 0;

  const trendStacked = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const trendTotal = Object.values(byDateTotal).sort((a, b) => a.date.localeCompare(b.date));
  const categoryTrend = Object.values(byCategory).sort((a, b) => a.date.localeCompare(b.date));
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
    revenue, tx, discounts, aov, discountRate,
    trendStacked, trendTotal, categoryTrend, paymentMix, categoryPie,
    topProducts, topDiscountedProducts, topCategories, topSubCategories, recentSales,
  };
}
