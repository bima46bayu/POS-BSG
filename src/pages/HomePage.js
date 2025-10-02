import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { 
  Search, Calendar, Store, Tag, Download, 
  TrendingUp, TrendingDown, DollarSign, 
  ShoppingCart, Receipt, Percent, ChevronDown,
  ArrowUpDown
} from "lucide-react";
import { api } from "../api/client";

/* ========== Utils ========== */
const IDR = (n) => Number(n || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const N = (v) => (v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")) || 0);
const shortIDR = (v) => (v>=1e9? (v/1e9).toFixed(1)+"M" : v>=1e6? (v/1e6).toFixed(1)+"jt" : v>=1e3? (v/1e3).toFixed(1)+"rb" : String(v));
const dayKey = (d) => { 
  const dt=new Date(d); 
  if(isNaN(dt)) return ""; 
  const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,"0"), dd=String(dt.getDate()).padStart(2,"0"); 
  return `${y}-${m}-${dd}`; 
};

const formatDate = (d) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};

const PIE_COLORS = ["#2563EB","#7C3AED","#EC4899","#10B981","#F59E0B","#EF4444","#06B6D4","#8B5CF6"];

const isDiscountItem = (it)=> N(it?.discount_nominal)>0 || N(it?.discount_percent)>0;
const isDiscountSale = (s)=> N(s?.discount)>0 || (Array.isArray(s?.items) && s.items.some(isDiscountItem));

/* ========== Date Range Generator ========== */
function generateDateRange(from, to) {
  const dates = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");
  
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    dates.push(dayKey(dt));
  }
  return dates;
}

/* ========== API Functions ========== */
async function fetchSales(params, signal){
  const { data } = await api.get("/api/sales", { params, signal });
  return Array.isArray(data?.data) ? data.data : data;
}

async function fetchStores(signal){
  try{ 
    const { data } = await api.get("/api/store-locations", { params: { per_page:100 }, signal }); 
    return Array.isArray(data?.data)?data.data:data; 
  }catch{ 
    return []; 
  }
}

async function fetchCategories(signal){
  try{ 
    const { data } = await api.get("/api/categories", { params: { per_page:100 }, signal }); 
    return Array.isArray(data?.data)?data.data:data; 
  }catch{ 
    return []; 
  }
}

async function fetchSubCategories(signal){
  try{ 
    const { data } = await api.get("/api/sub-categories", { params: { per_page:100 }, signal }); 
    return Array.isArray(data?.data)?data.data:data; 
  }catch{ 
    return []; 
  }
}

/* ========== PDF Export Function ========== */
async function exportToPDF(data, filters, aggRange) {
  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sales Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; background: white; }
          h1 { color: #1e293b; font-size: 28px; margin-bottom: 10px; }
          .subtitle { color: #64748b; font-size: 14px; margin-bottom: 30px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
          .kpi-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
          .kpi-title { color: #64748b; font-size: 12px; margin-bottom: 8px; }
          .kpi-value { color: #1e293b; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .kpi-trend { color: #64748b; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
          .section-title { font-size: 16px; font-weight: bold; color: #1e293b; margin: 30px 0 15px 0; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <h1>📊 Sales Report - Dashboard POS</h1>
        <div class="subtitle">Periode: ${formatDate(filters.from)} - ${formatDate(filters.to)}</div>
        
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Total Revenue</div>
            <div class="kpi-value">${IDR(aggRange.revenue)}</div>
            <div class="kpi-trend">vs periode sebelumnya</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Transaksi</div>
            <div class="kpi-value">${aggRange.tx.toLocaleString("id-ID")}</div>
            <div class="kpi-trend">vs periode sebelumnya</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Average Order Value</div>
            <div class="kpi-value">${IDR(aggRange.aov)}</div>
            <div class="kpi-trend">rata-rata per transaksi</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Diskon</div>
            <div class="kpi-value">${IDR(aggRange.discounts)}</div>
            <div class="kpi-trend">${(aggRange.discountRate * 100).toFixed(1)}% transaksi pakai diskon</div>
          </div>
        </div>

        <div class="section-title">📈 Kategori Terlaris</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Kategori</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Transaksi</th>
              <th class="text-right">Revenue</th>
              <th class="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            ${aggRange.topCategories.slice(0, 10).map((cat, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${cat.name}</td>
                <td class="text-right">${cat.qty.toLocaleString("id-ID")}</td>
                <td class="text-right">${cat.txCount.toLocaleString("id-ID")}</td>
                <td class="text-right">${IDR(cat.revenue)}</td>
                <td class="text-right">${cat.share.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">🏷️ Produk Terlaris</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produk</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Revenue</th>
              <th class="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            ${aggRange.topProducts.slice(0, 10).map((prod, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${prod.name}</td>
                <td class="text-right">${prod.qty.toLocaleString("id-ID")}</td>
                <td class="text-right">${IDR(prod.revenue)}</td>
                <td class="text-right">${prod.share.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
          Generated on ${new Date().toLocaleString("id-ID")} | Dashboard POS
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/* ========== Components ========== */
function KpiCard({ title, value, delta, icon: Icon, trend }) {
  const isPositive = delta >= 0;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        {delta !== null && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {trend && <p className="text-xs text-slate-500">{trend}</p>}
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters, stores, onExport, isLoading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Pencarian
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Cari invoice, produk, kasir..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Dari Tanggal
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Sampai Tanggal
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cabang
          </label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
            <select
              value={filters.storeId}
              onChange={(e) => setFilters(f => ({ ...f, storeId: e.target.value }))}
              className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">Semua</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onlyDiscount}
            onChange={(e) => setFilters(f => ({ ...f, onlyDiscount: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <Tag className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Hanya Transaksi Diskon</span>
        </label>

        <button
          onClick={onExport}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "", action }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function DataTable({ columns, data, emptyMessage = "Tidak ada data" }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <div className="inline-block min-w-full align-middle px-5">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    col.align === "right" ? "text-right" : ""
                  } ${col.width || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col, colIdx) => {
                    let value = row[col.key];
                    if (col.render) value = col.render(value, row, idx);
                    return (
                      <td
                        key={colIdx}
                        className={`px-3 py-3 text-sm text-slate-900 ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========== Aggregation ========== */
function aggregateForRange(sales, from, to, categoriesMap, subCategoriesMap) {
  let revenue = 0, tx = 0, discounts = 0, items = 0;
  const byDate = {};
  const byDateTotal = {};
  const byCategory = {};
  const byCategoryForPie = {};
  const payMix = {};
  const byProduct = {};
  const byProductDiscounted = {};
  const byCategoryStats = {};
  const bySubCategory = {};

  const allDates = generateDateRange(from, to);
  allDates.forEach(date => {
    byDate[date] = { date, discount: 0, non_discount: 0 };
    byDateTotal[date] = { date, total: 0 };
  });

  for (const s of sales) {
    const total = N(s?.total);
    const dKey = dayKey(s?.created_at || Date.now());
    const itemsArr = Array.isArray(s?.items) ? s.items : [];

    revenue += total;
    tx += 1;
    discounts += N(s?.discount);
    items += itemsArr.reduce((a, it) => a + N(it?.qty ?? it?.quantity ?? 1), 0);

    if (byDate[dKey]) {
      if (isDiscountSale(s)) {
        byDate[dKey].discount += total;
      } else {
        byDate[dKey].non_discount += total;
      }
    }

    if (byDateTotal[dKey]) {
      byDateTotal[dKey].total += total;
    }

    const pays = Array.isArray(s?.payments) ? s.payments : [];
    if (pays.length === 0) {
      payMix["Cash"] = (payMix["Cash"] || 0) + total;
    } else {
      for (const p of pays) {
        payMix[p?.method || "Cash"] = (payMix[p?.method || "Cash"] || 0) + N(p?.amount);
      }
    }

    for (const it of itemsArr) {
      const product = it?.product || {};
      const categoryId = product?.category_id || null;
      const subCategoryId = product?.sub_category_id || null;
      
      const categoryName = categoryId && categoriesMap[categoryId] ? categoriesMap[categoryId].name : "Uncategorized";
      const subCategoryName = subCategoryId && subCategoriesMap[subCategoryId] ? subCategoriesMap[subCategoryId].name : "Other";
      
      const productName = product?.name || it?.name || `Product #${it?.product_id || "?"}`;
      const qty = N(it?.qty ?? it?.quantity ?? 1);
      const lineTotal = N(it?.line_total ?? it?.subtotal ?? N(it?.price) * qty);

      if (!byCategoryStats[categoryName]) {
        byCategoryStats[categoryName] = { name: categoryName, qty: 0, revenue: 0, tx: new Set() };
      }
      byCategoryStats[categoryName].qty += qty;
      byCategoryStats[categoryName].revenue += lineTotal;
      byCategoryStats[categoryName].tx.add(s.id);

      byCategoryForPie[categoryName] = (byCategoryForPie[categoryName] || 0) + lineTotal;

      const subKey = `${categoryName}::${subCategoryName}`;
      if (!bySubCategory[subKey]) {
        bySubCategory[subKey] = { category: categoryName, subCategory: subCategoryName, qty: 0, revenue: 0, tx: new Set() };
      }
      bySubCategory[subKey].qty += qty;
      bySubCategory[subKey].revenue += lineTotal;
      bySubCategory[subKey].tx.add(s.id);

      if (!byCategory[dKey]) byCategory[dKey] = { date: dKey };
      byCategory[dKey][categoryName] = (byCategory[dKey][categoryName] || 0) + lineTotal;

      byProduct[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0 };
      byProduct[productName].qty += qty;
      byProduct[productName].revenue += lineTotal;

      if (isDiscountItem(it) || N(s?.discount) > 0) {
        byProductDiscounted[productName] ||= { key: productName, name: productName, qty: 0, revenue: 0, used: 0 };
        byProductDiscounted[productName].qty += qty;
        byProductDiscounted[productName].revenue += lineTotal;
        byProductDiscounted[productName].used += 1;
      }
    }
  }

  const aov = tx ? revenue / tx : 0;
  const discountRate = tx ? (sales.filter(isDiscountSale).length / tx) : 0;

  const trendStacked = Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
  const trendTotal = Object.values(byDateTotal).sort((a, b) => (a.date < b.date ? -1 : 1));
  const categoryTrend = Object.values(byCategory).sort((a, b) => (a.date < b.date ? -1 : 1));
  const paymentMix = Object.entries(payMix).map(([method, amount]) => ({ method, amount }));
  const categoryPie = Object.entries(byCategoryForPie).map(([category, amount]) => ({ category, amount }));

  const topProducts = Object.values(byProduct)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map(p => ({ ...p, share: revenue ? (p.revenue / revenue * 100) : 0 }));

  const topDiscountedProducts = Object.values(byProductDiscounted)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map(p => ({ ...p, discount_used: tx ? (p.used / tx * 100) : 0 }));

  const topCategories = Object.values(byCategoryStats)
    .map(c => ({ ...c, txCount: c.tx.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(c => ({ ...c, share: revenue ? (c.revenue / revenue * 100) : 0 }));

  const topSubCategories = Object.values(bySubCategory)
    .map(c => ({ ...c, txCount: c.tx.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  const recentSales = [...sales]
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
    categoryTrend,
    paymentMix,
    categoryPie,
    topProducts,
    topDiscountedProducts,
    topCategories,
    topSubCategories,
    recentSales,
  };
}

/* ========== Main Component ========== */
export default function HomePage() {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [filters, setFilters] = React.useState({
    search: "",
    from: todayISO,
    to: todayISO,
    storeId: "",
    onlyDiscount: false,
  });

  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [categorySortOrder, setCategorySortOrder] = React.useState("desc");
  const [subCategorySortOrder, setSubCategorySortOrder] = React.useState("desc");
  const [productSortOrder, setProductSortOrder] = React.useState("desc");
  const [discountProductSortOrder, setDiscountProductSortOrder] = React.useState("desc");

  const storesQ = useQuery({
    queryKey: ["stores"],
    queryFn: ({ signal }) => fetchStores(signal),
    staleTime: 5 * 60_000,
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 5 * 60_000,
  });

  const subCategoriesQ = useQuery({
    queryKey: ["subCategories"],
    queryFn: ({ signal }) => fetchSubCategories(signal),
    staleTime: 5 * 60_000,
  });

  const salesQ = useQuery({
    queryKey: ["sales", filters],
    queryFn: ({ signal }) =>
      fetchSales(
        {
          search: filters.search,
          from: filters.from,
          to: filters.to,
          store_location_id: filters.storeId || undefined,
          only_discount: filters.onlyDiscount || undefined,
        },
        signal
      ),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const salesRaw = salesQ.data || [];
  const categoriesData = categoriesQ.data || [];
  const subCategoriesData = subCategoriesQ.data || [];

  const categoriesMap = React.useMemo(() => {
    const map = {};
    categoriesData.forEach(cat => {
      map[cat.id] = cat;
    });
    return map;
  }, [categoriesData]);

  const subCategoriesMap = React.useMemo(() => {
    const map = {};
    subCategoriesData.forEach(sub => {
      map[sub.id] = sub;
    });
    return map;
  }, [subCategoriesData]);

  const filterNonDate = React.useCallback(
    (s) => {
      if (filters.storeId) {
        const sl = s?.cashier?.store_location || s?.cashier?.storeLocation;
        const sid = sl?.id ?? s?.store_location_id ?? null;
        if (String(sid || "") !== String(filters.storeId)) return false;
      }
      if (filters.onlyDiscount && !isDiscountSale(s)) return false;
      if (filters.search) {
        const hay = `${s?.code || ""} ${s?.customer_name || ""} ${s?.cashier?.name || ""} ${JSON.stringify(
          s?.items || []
        )}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    },
    [filters]
  );

  const rangeSales = React.useMemo(() => {
    const fromTs = filters.from ? new Date(filters.from + "T00:00:00").getTime() : -Infinity;
    const toTs = filters.to ? new Date(filters.to + "T23:59:59").getTime() : Infinity;
    return salesRaw.filter((s) => {
      const t = new Date(s?.created_at || s?.createdAt || Date.now()).getTime();
      if (t < fromTs || t > toTs) return false;
      return filterNonDate(s);
    });
  }, [salesRaw, filters.from, filters.to, filterNonDate]);

  const prevFrom = React.useMemo(() => {
    const start = new Date(filters.from + "T00:00:00");
    const end = new Date(filters.to + "T23:59:59");
    const lenMs = end - start + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lenMs + 1);
    return { start: prevStart, end: prevEnd };
  }, [filters.from, filters.to]);

  const prevSales = React.useMemo(() => {
    return salesRaw.filter((s) => {
      const t = new Date(s?.created_at || s?.createdAt || Date.now()).getTime();
      if (!(t >= prevFrom.start.getTime() && t <= prevFrom.end.getTime())) return false;
      return filterNonDate(s);
    });
  }, [salesRaw, prevFrom, filterNonDate]);

  const aggRange = React.useMemo(() => 
    aggregateForRange(rangeSales, filters.from, filters.to, categoriesMap, subCategoriesMap), 
    [rangeSales, filters.from, filters.to, categoriesMap, subCategoriesMap]
  );
  
  const aggPrev = React.useMemo(() => {
    const prevFromKey = dayKey(prevFrom.start);
    const prevToKey = dayKey(prevFrom.end);
    return aggregateForRange(prevSales, prevFromKey, prevToKey, categoriesMap, subCategoriesMap);
  }, [prevSales, prevFrom, categoriesMap, subCategoriesMap]);

  const delta = (now, prev) => (prev > 0 ? ((now - prev) / prev) * 100 : null);

  const categories = React.useMemo(() => {
    const cats = new Set();
    aggRange.topSubCategories.forEach(s => cats.add(s.category));
    return Array.from(cats).sort();
  }, [aggRange.topSubCategories]);

  const filteredSubCategories = React.useMemo(() => {
    let data = aggRange.topSubCategories;
    if (categoryFilter) {
      data = data.filter(s => s.category === categoryFilter);
    }
    return data.sort((a, b) => {
      return subCategorySortOrder === "desc" ? b.revenue - a.revenue : a.revenue - b.revenue;
    });
  }, [aggRange.topSubCategories, categoryFilter, subCategorySortOrder]);

  const sortedCategories = React.useMemo(() => {
    return [...aggRange.topCategories].sort((a, b) => {
      return categorySortOrder === "desc" ? b.revenue - a.revenue : a.revenue - b.revenue;
    });
  }, [aggRange.topCategories, categorySortOrder]);

  const sortedProducts = React.useMemo(() => {
    return [...aggRange.topProducts].sort((a, b) => {
      return productSortOrder === "desc" ? b.qty - a.qty : a.qty - b.qty;
    });
  }, [aggRange.topProducts, productSortOrder]);

  const sortedDiscountProducts = React.useMemo(() => {
    return [...aggRange.topDiscountedProducts].sort((a, b) => {
      return discountProductSortOrder === "desc" ? b.qty - a.qty : a.qty - b.qty;
    });
  }, [aggRange.topDiscountedProducts, discountProductSortOrder]);

  const handleExport = () => {
    exportToPDF(rangeSales, filters, aggRange);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard POS</h1>
            <p className="text-sm text-slate-600 mt-1">
              Periode: {formatDate(filters.from)} - {formatDate(filters.to)}
            </p>
          </div>
          {salesQ.isFetching && (
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Memuat data...
            </div>
          )}
        </div>

        <FilterBar
          filters={filters}
          setFilters={setFilters}
          stores={storesQ.data || []}
          onExport={handleExport}
          isLoading={salesQ.isFetching}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            title="Total Revenue"
            value={IDR(aggRange.revenue)}
            delta={delta(aggRange.revenue, aggPrev.revenue)}
            icon={DollarSign}
            trend="vs periode sebelumnya"
          />
          <KpiCard
            title="Total Transaksi"
            value={aggRange.tx.toLocaleString("id-ID")}
            delta={delta(aggRange.tx, aggPrev.tx)}
            icon={Receipt}
            trend="vs periode sebelumnya"
          />
          <KpiCard
            title="Average Order Value"
            value={IDR(aggRange.aov)}
            delta={delta(aggRange.aov, aggPrev.aov)}
            icon={ShoppingCart}
            trend="rata-rata per transaksi"
          />
          <KpiCard
            title="Total Diskon"
            value={IDR(aggRange.discounts)}
            delta={delta(aggRange.discounts, aggPrev.discounts)}
            icon={Percent}
            trend={`${(aggRange.discountRate * 100).toFixed(1)}% transaksi pakai diskon`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <ChartCard title="Pendapatan" className="xl:col-span-2">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aggRange.trendTotal} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <YAxis 
                    tickFormatter={shortIDR} 
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <Tooltip 
                    formatter={(v) => IDR(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Pendapatan"
                    stroke="#2563EB"
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Komposisi Metode Pembayaran">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggRange.paymentMix}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {aggRange.paymentMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v) => IDR(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <ChartCard title="Trend Penjualan Diskon vs Non Diskon" className="xl:col-span-2">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggRange.trendStacked} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <YAxis 
                    tickFormatter={shortIDR}
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <Tooltip 
                    formatter={(v) => IDR(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  <Line
                    type="monotone"
                    dataKey="discount"
                    name="Diskon"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="non_discount"
                    name="Non-Diskon"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Penjualan per Kategori">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggRange.categoryPie}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {aggRange.categoryPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v) => IDR(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <ChartCard 
            title="Kategori Terlaris"
            action={
              <button
                onClick={() => setCategorySortOrder(o => o === "desc" ? "asc" : "desc")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={categorySortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <DataTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Kategori" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "txCount", label: "Transaksi", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "share", label: "Share", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedCategories}
            />
          </ChartCard>

          <ChartCard 
            title="Sub-Kategori Terlaris"
            action={
              <button
                onClick={() => setSubCategorySortOrder(o => o === "desc" ? "asc" : "desc")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={subCategorySortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <div className="mb-4">
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <DataTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "category", label: "Kategori" },
                { key: "subCategory", label: "Sub-Kategori" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
              ]}
              data={filteredSubCategories.slice(0, 10)}
            />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <ChartCard 
            title="Produk Terlaris (By Quantity)"
            action={
              <button
                onClick={() => setProductSortOrder(o => o === "desc" ? "asc" : "desc")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={productSortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <DataTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Produk" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "share", label: "Share", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedProducts}
            />
          </ChartCard>

          <ChartCard 
            title="Produk Dengan Diskon Terlaris"
            action={
              <button
                onClick={() => setDiscountProductSortOrder(o => o === "desc" ? "asc" : "desc")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={discountProductSortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <DataTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Produk" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "discount_used", label: "% Trx Diskon", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedDiscountProducts}
            />
          </ChartCard>
        </div>

        <ChartCard title="Transaksi Terbaru">
          <DataTable
            columns={[
              { key: "code", label: "Invoice", render: (_, row) => (
                <span className="font-semibold text-blue-600">{row.code || row.id}</span>
              )},
              { key: "created_at", label: "Waktu", render: (v) => 
                new Date(v).toLocaleString("id-ID", { 
                  day: "2-digit", 
                  month: "short", 
                  hour: "2-digit", 
                  minute: "2-digit" 
                })
              },
              { key: "cashier", label: "Kasir", render: (_, row) => row?.cashier?.name || "-" },
              { key: "store", label: "Toko", render: (_, row) => {
                const sl = row?.cashier?.store_location || row?.cashier?.storeLocation;
                return sl?.name || "-";
              }},
              { key: "items", label: "Item", align: "right", render: (_, row) => {
                const items = Array.isArray(row?.items) ? row.items : [];
                return items.reduce((a, it) => a + N(it?.qty ?? it?.quantity ?? 1), 0);
              }},
              { key: "total", label: "Total", align: "right", render: (v) => (
                <span className="font-semibold">{IDR(N(v))}</span>
              )},
              { key: "payments", label: "Metode", render: (_, row) => {
                const pays = Array.isArray(row?.payments) ? row.payments : [];
                const methods = pays.map(p => p?.method).filter(Boolean);
                return methods.length > 0 ? (
                  <span className="text-xs px-2 py-1 bg-slate-100 rounded-full">
                    {methods.join(", ")}
                  </span>
                ) : "-";
              }},
            ]}
            data={aggRange.recentSales}
            emptyMessage="Belum ada transaksi dalam periode ini"
          />
        </ChartCard>

        <div className="flex items-center justify-between text-sm text-slate-500 pb-4">
          <div>
            Menampilkan {aggRange.recentSales.length} dari {rangeSales.length} transaksi
          </div>
          <div>
            Last updated: {new Date().toLocaleTimeString("id-ID")}
          </div>
        </div>
      </div>
    </div>
  );
}