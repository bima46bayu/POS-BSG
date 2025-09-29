import React from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { api } from "../api/client"; // asumsi ada instance axios

/**
 * FE-ONLY DASHBOARD (olah data di frontend):
 * - Menarik data penjualan dari endpoint /api/sales (sesuaikan di fetchSales)
 * - Semua agregasi (KPI, tren, top produk, payment mix, kasir, heatmap jam sibuk) dilakukan di FE
 * - Filter global: tanggal (from/to) & store_location_id (opsional)
 */

// ===== Utilities =====
const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const toNumber = (v) => (v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")) || 0);

function parseDateKey(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  // YYYY-MM-DD
  return dt.toISOString().slice(0, 10);
}

function hourOf(d) {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getHours();
}

// group by key function
function groupBy(arr, getKey) {
  return arr.reduce((acc, x) => {
    const k = getKey(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}

// ===== Fetchers =====
async function fetchSales({ from, to, storeId, signal }) {
  // Sesuaikan dengan API kamu. Idealnya backend mendukung filter ini,
  // tetapi jika tidak, FE akan memfilter sendiri di bawah.
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (storeId) params.store_location_id = storeId;

  const { data } = await api.get("/api/sales", { params, signal });
  // Expected: array of sales
  // { id, code, created_at, total, discount, tax, service_charge, cashier: {id,name,store_location|storeLocation},
  //   items: [{product_id,name,qty,quantity,price,subtotal}], payments: [{method,amount}] }
  return Array.isArray(data?.data) ? data.data : data; // dukung paginate laravel
}

async function fetchStores(signal) {
  // opsional; untuk filter per cabang. Abaikan jika endpoint belum ada.
  try {
    const { data } = await api.get("/api/store-locations", { params: { per_page: 100 }, signal });
    return Array.isArray(data?.data) ? data.data : data;
  } catch {
    return [];
  }
}

// ===== Main Component =====
export default function HomePage() {
  // Filter global
  const [from, setFrom] = React.useState(() => new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().slice(0, 10)); // 7 hari terakhir
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [storeId, setStoreId] = React.useState("");

  const salesQ = useQuery({
    queryKey: ["sales", { from, to, storeId }],
    queryFn: ({ signal }) => fetchSales({ from, to, storeId, signal }),
    staleTime: 60_000,
  });

  const storesQ = useQuery({
    queryKey: ["stores"],
    queryFn: ({ signal }) => fetchStores(signal),
    staleTime: 5 * 60_000,
  });

  const sales = salesQ.data || [];

  // FE-side filtering fallback (jaga-jaga bila BE belum terapkan filter)
  const filtered = React.useMemo(() => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return sales.filter((s) => {
      const t = new Date(s?.created_at ?? s?.createdAt ?? Date.now()).getTime();
      if (t < fromTs || t > toTs) return false;
      if (!storeId) return true;
      const cashier = s?.cashier || {};
      const sl = cashier.storeLocation || cashier.store_location || null;
      const saleStoreId = sl?.id ?? s?.store_location_id ?? null;
      return String(saleStoreId || "") === String(storeId || "");
    });
  }, [sales, from, to, storeId]);

  // ===== Aggregations =====
  const agg = React.useMemo(() => {
    const result = {
      revenue: 0,
      transactions: 0,
      itemsQty: 0,
      discounts: 0,
      taxes: 0,
      service: 0,
      byDate: {}, // key: YYYY-MM-DD → { revenue, tx }
      byProduct: {}, // name/SKU → { qty, revenue }
      byCashier: {}, // name → { revenue, tx }
      paymentMix: {}, // method → amount
      heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)), // day(0-6) vs hour(0-23)
    };

    for (const s of filtered) {
      const total = toNumber(s?.total);
      const tax = toNumber(s?.tax);
      const svc = toNumber(s?.service_charge);
      const disc = toNumber(s?.discount);

      result.revenue += total;
      result.discounts += disc;
      result.taxes += tax;
      result.service += svc;
      result.transactions += 1;

      // By date
      const dkey = parseDateKey(s?.created_at ?? s?.createdAt ?? Date.now());
      result.byDate[dkey] ||= { date: dkey, revenue: 0, tx: 0 };
      result.byDate[dkey].revenue += total;
      result.byDate[dkey].tx += 1;

      // Items
      const items = Array.isArray(s?.items) ? s.items : [];
      for (const it of items) {
        const name = it?.product?.name || it?.name || `SKU-${it?.product_id ?? it?.id ?? "?"}`;
        const qty = toNumber(it?.qty ?? it?.quantity ?? 1);
        const line = toNumber(it?.line_total ?? it?.subtotal ?? qty * toNumber(it?.price));
        result.itemsQty += qty;
        result.byProduct[name] ||= { name, qty: 0, revenue: 0 };
        result.byProduct[name].qty += qty;
        result.byProduct[name].revenue += line;
      }

      // Cashier
      const cashierName = s?.cashier?.name || "-";
      result.byCashier[cashierName] ||= { name: cashierName, revenue: 0, tx: 0 };
      result.byCashier[cashierName].revenue += total;
      result.byCashier[cashierName].tx += 1;

      // Payment mix
      const pays = Array.isArray(s?.payments) ? s.payments : [];
      if (pays.length === 0) {
        result.paymentMix["Unknown"] = (result.paymentMix["Unknown"] || 0) + total;
      } else {
        for (const p of pays) {
          const method = p?.method || "Unknown";
          const amt = toNumber(p?.amount);
          result.paymentMix[method] = (result.paymentMix[method] || 0) + (amt || 0);
        }
      }

      // Heatmap (weekday x hour) berdasar waktu transaksi
      const dt = new Date(s?.created_at ?? s?.createdAt ?? Date.now());
      const weekday = dt.getDay(); // 0-6
      const hour = dt.getHours(); // 0-23
      if (result.heatmap[weekday]) result.heatmap[weekday][hour] += 1;
    }

    // Convert dicts to arrays & sort
    const trend = Object.values(result.byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
    const topProducts = Object.values(result.byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const byCashier = Object.values(result.byCashier).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const paymentMix = Object.entries(result.paymentMix).map(([method, amount]) => ({ method, amount }));

    const aov = result.transactions ? result.revenue / result.transactions : 0;
    const unitsPerTxn = result.transactions ? result.itemsQty / result.transactions : 0;

    return { ...result, trend, topProducts, byCashier, paymentMix, aov, unitsPerTxn };
  }, [filtered]);

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#8dd1e1", "#a4de6c", "#d0ed57", "#d885a3"]; // untuk pie

  return (
    <div className="p-4 space-y-4">
      {/* FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Dari</label>
          <input type="date" className="w-full border rounded px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Sampai</label>
          <input type="date" className="w-full border rounded px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Cabang</label>
          <select className="w-full border rounded px-2 py-1" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {(storesQ.data || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-black text-white" onClick={() => salesQ.refetch()}>Refresh</button>
          {salesQ.isFetching && <span className="text-sm text-gray-600 self-center">Memuat…</span>}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total Penjualan" value={fmtIDR(agg.revenue)} />
        <KpiCard title="Transaksi" value={agg.transactions} />
        <KpiCard title="Item Terjual" value={agg.itemsQty} />
        <KpiCard title="AOV" value={fmtIDR(agg.aov)} />
      </div>

      {/* TREN PENJUALAN */}
      <Section title="Tren Penjualan (Revenue & Transaksi)">
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={agg.trend} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" tickFormatter={(v) => (v >= 1000000 ? `${(v/1e6).toFixed(1)}jt` : v.toLocaleString("id-ID"))} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(v, n) => (n === "revenue" ? fmtIDR(v) : v)} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#8884d8" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="tx" name="Transaksi" stroke="#82ca9d" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* BY CASHIER & PAYMENT MIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Performa Kasir (Top 10 Revenue)">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={agg.byCashier} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => (v >= 1000000 ? `${(v/1e6).toFixed(1)}jt` : v.toLocaleString("id-ID"))} />
                <Tooltip formatter={(v) => fmtIDR(v)} />
                <Bar dataKey="revenue" name="Revenue" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Metode Pembayaran">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={agg.paymentMix} dataKey="amount" nameKey="method" outerRadius={100} label>
                  {agg.paymentMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtIDR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* TOP PRODUCTS */}
      <Section title="Top Produk (Revenue)">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Produk</th>
                <th className="py-2 pr-2">Qty</th>
                <th className="py-2 pr-2">Revenue</th>
                <th className="py-2 pr-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {agg.topProducts.map((p, i) => {
                const share = agg.revenue ? (p.revenue / agg.revenue) * 100 : 0;
                return (
                  <tr key={p.name} className="border-b last:border-none">
                    <td className="py-2 pr-2">{i + 1}</td>
                    <td className="py-2 pr-2">{p.name}</td>
                    <td className="py-2 pr-2">{p.qty}</td>
                    <td className="py-2 pr-2">{fmtIDR(p.revenue)}</td>
                    <td className="py-2 pr-2">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* BUSY HOURS HEATMAP */}
      <Section title="Jam Sibuk (Transaksi)">
        <HeatmapGrid data={agg.heatmap} />
      </Section>
    </div>
  );
}

// ===== UI Subcomponents =====
function KpiCard({ title, value, hint }) {
  return (
    <div className="p-3 rounded-2xl shadow border bg-white">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="p-3 rounded-2xl shadow border bg-white">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

function HeatmapGrid({ data }) {
  // data: 7 x 24 (rows = Sun..Sat)
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const flat = data.flat();
  const max = flat.length ? Math.max(...flat) : 0;

  return (
    <div className="overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(24, minmax(16px, 1fr))` }}>
        {/* Header jam */}
        <div></div>
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[10px] text-gray-500 text-center">{h}</div>
        ))}

        {data.map((row, dayIdx) => (
          <React.Fragment key={dayIdx}>
            <div className="text-[12px] text-gray-600 pr-2 flex items-center">{days[dayIdx]}</div>
            {row.map((v, h) => {
              const ratio = max ? v / max : 0;
              const bg = `rgba(34,197,94,${0.1 + ratio * 0.9})`; // hijau dengan intensitas
              return <div key={`${dayIdx}-${h}`} className="h-4 m-[2px] rounded" title={`${days[dayIdx]} ${h}:00 → ${v} trx`} style={{ backgroundColor: bg }} />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
