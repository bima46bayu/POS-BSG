// src/pages/HomePage.jsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  DollarSign, Receipt, ShoppingCart, Percent,
  Table as TableIcon, Tag, ChevronDown as ChevronDownIcon, ArrowUpDown,
} from "lucide-react";

import KpiCard from "../components/dashboard/KpiCard";
import SimpleTable from "../components/dashboard/SimpleTable";
import FilterBar from "../components/dashboard/FilterBar";
import DailyMatrixModal from "../components/dashboard/DailyMatrixModal";

import { api } from "../api/client";
import { listSalesForDashboard } from "../api/sales";
import { getMe } from "../api/users";
import { getProductsSummaryBatch } from "../api/inventory"; // batch summary semua produk

import {
  IDR, N, shortIDR, formatDate, generateDateRange, dayKey, PIE_COLORS,
  payBadgeClass, methodLabel, normMethodKey
} from "../lib/fmt";
import { aggregateForRange } from "../lib/aggregate";
import { exportToPDF } from "../lib/exportPdf";

/* ========== Master data ringan ========== */
async function fetchStores(signal) {
  try {
    const { data } = await api.get("/api/store-locations", { params: { per_page: 100 }, signal });
    return Array.isArray(data?.data) ? data.data : data;
  } catch { return []; }
}
async function fetchCategories(signal) {
  try {
    const { data } = await api.get("/api/categories", { params: { per_page: 100 }, signal });
    return Array.isArray(data?.data) ? data.data : data;
  } catch { return []; }
}
async function fetchSubCategories(signal) {
  try {
    const { data } = await api.get("/api/sub-categories", { params: { per_page: 100 }, signal });
    return Array.isArray(data?.data) ? data.data : data;
  } catch { return []; }
}

/* ========== Util aman untuk shape /api/users/me ========== */
const pickMe = (raw) => {
  const me = raw?.data ?? raw ?? {};
  return {
    id: me.id ?? null,
    role: String(me.role ?? "").toLowerCase(),
    store_location_id:
      me.store_location_id ?? me.storeLocationId ?? me.store_location?.id ?? null,
  };
};

// ==== Helper: deteksi transaksi diskon (robust di berbagai shape) ====
const hasDiscount = (sale) => {
  if (!sale) return false;

  // kandidat field diskon di header/transaksi
  const headerDiscountFields = [
    "discount", "discount_amount", "discount_value", "discount_total",
    "disc", "disc_amount", "total_discount"
  ];
  for (const k of headerDiscountFields) {
    const v = Number(sale?.[k] ?? 0);
    if (Number.isFinite(v) && v > 0) return true;
  }

  // beberapa API simpan "grand_total" + "total_before_discount"
  const total = Number(sale?.total ?? sale?.grand_total ?? 0);
  const before = Number(sale?.total_before_discount ?? sale?.subtotal ?? 0);
  if (Number.isFinite(total) && Number.isFinite(before) && before > 0 && total < before) {
    return true;
  }

  // cek per item
  const items = Array.isArray(sale?.items) ? sale.items : [];
  for (const it of items) {
    const discCandidates = [
      "discount", "discount_amount", "discount_value", "disc", "disc_amount"
    ];
    if (discCandidates.some((k) => Number(it?.[k] ?? 0) > 0)) return true;

    const qty = Number(it?.qty ?? it?.quantity ?? 1);
    const unitPrice = Number(it?.unit_price ?? it?.price ?? it?.selling_price ?? 0);
    const listPrice = Number(it?.list_price ?? it?.price_before ?? it?.regular_price ?? unitPrice);
    const subtotal = Number(it?.subtotal ?? it?.line_total ?? qty * unitPrice);

    // if ada list price & unit price turun
    if (Number.isFinite(listPrice) && listPrice > 0 && unitPrice < listPrice) return true;

    // Jika subtotal < qty * unitPrice (indikasi diskon baris)
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(unitPrice)) {
      if (subtotal < qty * unitPrice - 1e-6) return true;
    }
  }

  return false;
};

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
  const [matrixOpen, setMatrixOpen] = React.useState(false);

  // === User (pakai /api/users/me) ===
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async ({ signal }) => pickMe(await getMe(signal)),
    staleTime: 5 * 60_000,
  });
  const me = meQ.data;
  const isCashier = (me?.role || "") === "kasir";

  // Kunci filter saat kasir (1 hari + cabang user)
  React.useEffect(() => {
    if (!me || !isCashier) return;
    const today = new Date().toISOString().slice(0, 10);
    setFilters((prev) => ({
      ...prev,
      from: today,
      to: today,
      storeId: me.store_location_id ? String(me.store_location_id) : "",
      search: "",
      onlyDiscount: false,
    }));
  }, [isCashier, me]);

  // Master data
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: ({ signal }) => fetchStores(signal), staleTime: 5 * 60_000 });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: ({ signal }) => fetchCategories(signal), staleTime: 5 * 60_000 });
  const subCategoriesQ = useQuery({ queryKey: ["subCategories"], queryFn: ({ signal }) => fetchSubCategories(signal), staleTime: 5 * 60_000 });

  // SALES untuk dashboard
  const salesQ = useQuery({
    queryKey: ["sales-dashboard", {
      from: filters.from,
      to: filters.to,
      store_location_id: filters.storeId || undefined,
      only_discount: filters.onlyDiscount ? 1 : undefined, // kirim 1 kalau true
      is_discount:   filters.onlyDiscount ? 1 : undefined, // mirror untuk kompat
      code: filters.search || undefined,
    }],
    queryFn: async ({ queryKey, signal }) => {
      const [, params] = queryKey;
      return listSalesForDashboard(params, signal);
    },
    enabled: !meQ.isLoading && (!isCashier || !!filters.from),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const salesRaw = salesQ.data || [];
  const categoriesMap = React.useMemo(
    () => Object.fromEntries((categoriesQ.data || []).map((c) => [c.id, c])),
    [categoriesQ.data]
  );
  const subCategoriesMap = React.useMemo(
    () => Object.fromEntries((subCategoriesQ.data || []).map((s) => [s.id, s])),
    [subCategoriesQ.data]
  );

  // Filter FE
  const filterNonDate = React.useCallback((s) => {
    if (String(s?.status || "").toLowerCase() === "void") return false;
    if (filters.storeId) {
      const sl = s?.cashier?.store_location || s?.cashier?.storeLocation;
      const sid = sl?.id ?? s?.store_location_id ?? null;
      if (String(sid || "") !== String(filters.storeId)) return false;
    }
    // pakai deteksi diskon robust
    if (filters.onlyDiscount && !hasDiscount(s)) return false;
    if (filters.search) {
      const hay = `${s?.code || ""} ${s?.customer_name || ""} ${s?.cashier?.name || ""} ${JSON.stringify(s?.items || [])}`.toLowerCase();
      if (!hay.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  }, [filters]);

  const rangeSales = React.useMemo(() => {
    const fromTs = filters.from ? new Date(filters.from + "T00:00:00").getTime() : -Infinity;
    const toTs = filters.to ? new Date(filters.to + "T23:59:59").getTime() : Infinity;
    return salesRaw.filter((s) => {
      const t = new Date(s?.created_at || s?.createdAt || Date.now()).getTime();
      if (t < fromTs || t > toTs) return false;
      return filterNonDate(s);
    });
  }, [salesRaw, filters.from, filters.to, filterNonDate]);

  // Kumpulkan semua product_id yang ada di transaksi range terpilih
  const productIdsInRange = React.useMemo(() => {
    const set = new Set();
    for (const s of rangeSales) {
      const items = Array.isArray(s?.items) ? s.items : [];
      for (const it of items) {
        const pid = it.product_id ?? it.productId ?? it.id;
        if (pid != null) set.add(Number(pid));
      }
    }
    return Array.from(set);
  }, [rangeSales]);

  // Periode sebelumnya (delta %)
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

  // Agregasi
  const aggRange = React.useMemo(
    () => aggregateForRange(rangeSales, filters.from, filters.to, categoriesMap, subCategoriesMap),
    [rangeSales, filters.from, filters.to, categoriesMap, subCategoriesMap]
  );
  const prevFromKey = React.useMemo(() => dayKey(prevFrom.start), [prevFrom.start]);
  const prevToKey   = React.useMemo(() => dayKey(prevFrom.end), [prevFrom.end]);
  const aggPrev = React.useMemo(
    () => aggregateForRange(prevSales, prevFromKey, prevToKey, categoriesMap, subCategoriesMap),
    [prevSales, prevFromKey, prevToKey, categoriesMap, subCategoriesMap]
  );

  const pctDelta = React.useCallback((now, prev) => {
    const EPS = 1e-6;
    if (prev == null || !isFinite(prev) || Math.abs(prev) < EPS) return null;
    return ((now - prev) / prev) * 100;
  }, []);

  // ===== Batch Summary: COGS & GP untuk SEMUA produk pada periode & store terpilih
  const allSummariesQ = useQuery({
    queryKey: ["all-product-summaries-batch", {
      ids: productIdsInRange,
      from: filters.from,
      to: filters.to,
      storeId: filters.storeId || null,
    }],
    queryFn: async ({ queryKey, signal }) => {
      const [, { ids, from, to, storeId }] = queryKey;
      if (!ids || ids.length === 0) {
        return { items: [], totals: { cogs: 0, gross_profit: 0 }, count: 0 };
      }
      const params = {
        from, to,
        date_from: from, // kompat dengan BE kamu
        date_to: to,
        store_id: storeId || undefined,
        max: 1000,
      };
      return getProductsSummaryBatch(ids, params, signal);
    },
    enabled: !!filters.from && !!filters.to && productIdsInRange.length > 0 && !meQ.isLoading,
    keepPreviousData: true,
    staleTime: 60_000,
  });

  // ===== Robust extraction + fallback hitung dari items
  const _batch = allSummariesQ.data || {};
  const _items = Array.isArray(_batch.items) ? _batch.items : [];
  const totalCogsAll =
    Number(_batch?.totals?.cogs ?? 0) ||
    _items.reduce((a, x) => a + Number(x?.cogs ?? 0), 0);
  const totalGrossProfitAll =
    Number(_batch?.totals?.gross_profit ?? 0) ||
    _items.reduce((a, x) => a + Number(x?.gross_profit ?? 0), 0);
  const summaryProductCount = Number(_batch?.count ?? _items.length ?? 0);

  // (opsional debug dev)
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[BATCH SUMMARY]", { _batch });
  }

  // Tabel turunan
  const categories = React.useMemo(() => {
    const cats = new Set();
    aggRange.topSubCategories.forEach((s) => cats.add(s.category));
    return Array.from(cats).sort();
  }, [aggRange.topSubCategories]);

  const filteredSubCategories = React.useMemo(() => {
    let data = aggRange.topSubCategories;
    if (categoryFilter) data = data.filter((s) => s.category === categoryFilter);
    return data.sort((a, b) => (subCategorySortOrder === "desc" ? b.revenue - a.revenue : a.revenue - b.revenue));
  }, [aggRange.topSubCategories, categoryFilter, subCategorySortOrder]);

  const sortedCategories = React.useMemo(
    () => [...aggRange.topCategories].sort((a, b) => (categorySortOrder === "desc" ? b.revenue - a.revenue : a.revenue - b.revenue)),
    [aggRange.topCategories, categorySortOrder]
  );

  const sortedProducts = React.useMemo(
    () => [...aggRange.topProducts].sort((a, b) => (productSortOrder === "desc" ? b.qty - a.qty : a.qty - b.qty)),
    [aggRange.topProducts, productSortOrder]
  );

  const sortedDiscountProducts = React.useMemo(
    () => [...aggRange.topDiscountedProducts].sort((a, b) => (discountProductSortOrder === "desc" ? b.qty - a.qty : a.qty - b.qty)),
    [aggRange.topDiscountedProducts, discountProductSortOrder]
  );

  const handleExport = () => exportToPDF(rangeSales, filters, aggRange);

  // Matriks harian
  const dateList = React.useMemo(() => generateDateRange(filters.from, filters.to), [filters.from, filters.to]);
  const byDay = React.useMemo(() => {
    const map = new Map();
    dateList.forEach((d) => map.set(d, []));
    for (const s of rangeSales) {
      const d = dayKey(s?.created_at || s?.createdAt || Date.now());
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(s);
    }
    for (const d of map.keys()) {
      map.set(d, (map.get(d) || []).filter((x) => String(x?.status || "").toLowerCase() !== "void"));
    }
    return map;
  }, [rangeSales, dateList]);

  const dailyRevenue = React.useMemo(() => {
    const map = new Map();
    dateList.forEach((d) => map.set(d, 0));
    for (const s of rangeSales) {
      if (String(s?.status || "").toLowerCase() === "void") continue;
      const d = dayKey(s?.created_at || s?.createdAt || Date.now());
      map.set(d, (map.get(d) || 0) + N(s.total));
    }
    return map;
  }, [rangeSales, dateList]);

  /* ===== UI ===== */

  const Section = ({ title, right, className = "", children }) => (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="font-semibold text-slate-900">{title}</div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b border-slate-200">
        <div className="max-w-auto mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard POS</h1>
            <p className="text-xs text-slate-600">
              Periode: {formatDate(filters.from)} - {formatDate(filters.to)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMatrixOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50"
              title="Lihat matriks transaksi harian"
            >
              <TableIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Matriks Harian</span>
            </button>
            {(salesQ.isFetching || allSummariesQ.isFetching) && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Memuat data...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-auto mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 to-white">
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-indigo-100 rounded-full opacity-60" />
          <div className="absolute -right-20 top-14 w-28 h-28 bg-emerald-100 rounded-full opacity-60" />
          <div className="relative p-6 md:p-8">
            <div className="text-xs uppercase tracking-wider text-slate-500">Ringkasan</div>
            <div className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">Overview Penjualan</div>
            <p className="mt-1 text-sm text-slate-600">
              Lihat performa revenue, transaksi, dan komposisi penjualan pada periode terpilih.
            </p>

            {/* FilterBar */}
            <div className="mt-5">
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                stores={storesQ.data || []}
                onExport={handleExport}
                isLoading={salesQ.isFetching || allSummariesQ.isFetching}
                locked={isCashier}
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
          <KpiCard title="Total Revenue" value={IDR(aggRange.revenue)} delta={pctDelta(aggRange.revenue, aggPrev.revenue)} icon={DollarSign} trend="vs periode sebelumnya" />
          <KpiCard title="Total Transaksi" value={aggRange.tx.toLocaleString("id-ID")} delta={pctDelta(aggRange.tx, aggPrev.tx)} icon={Receipt} trend="vs periode sebelumnya" />
          <KpiCard title="Average Order Value" value={IDR(aggRange.aov)} delta={pctDelta(aggRange.aov, aggPrev.aov)} icon={ShoppingCart} trend="rata-rata per transaksi" />
          <KpiCard title="Total Diskon" value={IDR(aggRange.discounts)} delta={pctDelta(aggRange.discounts, aggPrev.discounts)} icon={Percent} trend={`${(aggRange.discountRate * 100).toFixed(1)}% transaksi pakai diskon`} />
          {/* === KPI BARU: total semua produk via endpoint batch === */}
          <KpiCard
            title="COGS (Sale)"
            value={IDR(totalCogsAll)}
            delta={null}
            icon={Tag}
            trend={`${summaryProductCount} produk pada periode`}
          />
          <KpiCard
            title="Gross Profit (Sale)"
            value={IDR(totalGrossProfitAll)}
            delta={null}
            icon={TableIcon}
            trend={`${summaryProductCount} produk pada periode`}
          />
        </div>

        {/* Charts 1 → 12-col grid, span 8/4 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Section
            title="Pendapatan"
            right={<span className="text-xs text-slate-500">Trend harian</span>}
            className="xl:col-span-8"
          >
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
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tickFormatter={shortIDR} tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => IDR(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  <Area type="monotone" dataKey="total" name="Total Pendapatan" stroke="#2563EB" fill="url(#colorTotal)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section
            title="Komposisi Metode Pembayaran"
            right={<span className="text-xs text-slate-500">Share per metode</span>}
            className="xl:col-span-4"
          >
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
                  <Tooltip formatter={(v) => IDR(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* Charts 2 → 12-col grid, span 8/4 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Section
            title="Trend Penjualan Diskon vs Non Diskon"
            right={<span className="text-xs text-slate-500">Perbandingan harian</span>}
            className="xl:col-span-8"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggRange.trendStacked} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tickFormatter={shortIDR} tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => IDR(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  <Line type="monotone" dataKey="discount" name="Diskon" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="non_discount" name="Non-Diskon" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section
            title="Penjualan per Kategori"
            right={<span className="text-xs text-slate-500">Share kategori</span>}
            className="xl:col-span-4"
          >
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
                  <Tooltip formatter={(v) => IDR(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Section
            title="Kategori Terlaris"
            right={
              <button
                onClick={() => setCategorySortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={categorySortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
              >
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <SimpleTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Kategori" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "txCount", label: "Transaksi", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "share", label: "Share", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedCategories}
              emptyMessage="Belum ada data kategori pada periode ini"
            />
          </Section>

          <Section
            title="Sub-Kategori Terlaris"
            right={
              <div className="flex items-center gap-2">
                <div className="relative min-w-[220px]">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                    title="Filter Kategori"
                  >
                    <option value="">Semua Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => setSubCategorySortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title={subCategorySortOrder === "desc" ? "Urutkan: Tertinggi ke Terendah" : "Urutkan: Terendah ke Tertinggi"}
                >
                  <ArrowUpDown className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            }
          >
            <div className="mb-4 px-4">
              <div className="text-xs text-slate-500">
                {categoryFilter ? <>Filter: <span className="font-semibold text-slate-700">{categoryFilter}</span></> : "Semua Kategori"}
              </div>
            </div>
            <SimpleTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "category", label: "Kategori" },
                { key: "subCategory", label: "Sub-Kategori" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
              ]}
              data={filteredSubCategories.slice(0, 10)}
              emptyMessage="Belum ada data sub-kategori pada periode ini"
            />
          </Section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Section
            title="Produk Terlaris (By Quantity)"
            right={
              <button onClick={() => setProductSortOrder((o) => (o === "desc" ? "asc" : "desc"))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <SimpleTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Produk" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "share", label: "Share", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedProducts}
              emptyMessage="Belum ada data produk pada periode ini"
            />
          </Section>

          <Section
            title="Produk Dengan Diskon Terlaris"
            right={
              <button onClick={() => setDiscountProductSortOrder((o) => (o === "desc" ? "asc" : "desc"))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowUpDown className="w-4 h-4 text-slate-600" />
              </button>
            }
          >
            <SimpleTable
              columns={[
                { key: "rank", label: "#", width: "w-12", render: (_, __, idx) => idx + 1 },
                { key: "name", label: "Produk" },
                { key: "qty", label: "Qty", align: "right", render: (v) => v.toLocaleString("id-ID") },
                { key: "revenue", label: "Revenue", align: "right", render: (v) => IDR(v) },
                { key: "discount_used", label: "% Trx Diskon", align: "right", render: (v) => `${v.toFixed(1)}%` },
              ]}
              data={sortedDiscountProducts}
              emptyMessage="Belum ada data diskon produk pada periode ini"
            />
          </Section>
        </div>

        <Section title="Transaksi Terbaru" right={<span className="text-xs text-slate-500">Update realtime</span>}>
          <SimpleTable
            columns={[
              { key: "code", label: "Invoice", render: (_, row) => <span className="font-semibold text-blue-600">{row.code || row.id}</span> },
              { key: "created_at", label: "Waktu", render: (v) => new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) },
              { key: "cashier", label: "Kasir", render: (_, row) => row?.cashier?.name || "-" },
              { key: "store", label: "Toko", render: (_, row) => (row?.cashier?.store_location || row?.cashier?.storeLocation)?.name || "-" },
              { key: "items", label: "Item", align: "right", render: (_, row) =>
                  (Array.isArray(row?.items) ? row.items : []).reduce((a, it) => a + N(it?.qty ?? it?.quantity ?? 1), 0)
                },
              { key: "total", label: "Total", align: "right", render: (v) => <span className="font-semibold">{IDR(N(v))}</span> },
              { key: "payments", label: "Metode", render: (_, row) => {
                  const pays = Array.isArray(row?.payments) ? row.payments : [];
                  if (!pays.length) {
                    return (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${payBadgeClass("cash")}`}>
                        Cash
                      </span>
                    );
                  }
                  const uniq = [...new Set(pays.map((p) => normMethodKey(p?.method)))].filter(Boolean);
                  return (
                    <div className="flex flex-wrap gap-1">
                      {uniq.map((k, i) => (
                        <span key={`${k}-${i}`} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${payBadgeClass(k)}`}>
                          {methodLabel(k)}
                        </span>
                      ))}
                    </div>
                  );
                }},
            ]}
            data={aggRange.recentSales}
            emptyMessage="Belum ada transaksi dalam periode ini"
          />
          <div className="flex items-center justify-between text-sm text-slate-500 px-4 py-3 border-t border-slate-200">
            <div>Menampilkan {aggRange.recentSales.length} dari {rangeSales.length} transaksi</div>
            <div>Last updated: {new Date().toLocaleTimeString("id-ID")}</div>
          </div>
        </Section>
      </div>

      <DailyMatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        dates={dateList}
        byDay={byDay}
        dailyRevenue={dailyRevenue}
      />
    </div>
  );
}
