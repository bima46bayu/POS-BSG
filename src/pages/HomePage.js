// src/pages/HomePage.jsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { api } from "../api/client";

/* ========== Utils ========== */
const IDR = (n) => Number(n || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const N = (v) => (v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")) || 0);
const shortIDR = (v) => (v>=1e9? (v/1e9).toFixed(1)+"M" : v>=1e6? (v/1e6).toFixed(1)+"jt" : v>=1e3? (v/1e3).toFixed(1)+"rb" : String(v));
const dayKey = (d) => { const dt=new Date(d); if(isNaN(dt)) return ""; const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,"0"), dd=String(dt.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
const PIE_COLORS = ["#F59E0B","#7C3AED","#10B981","#3B82F6","#EF4444","#14B8A6"];

const isDiscountItem = (it)=> N(it?.discount_nominal)>0 || N(it?.discount_percent)>0;
const isDiscountSale = (s)=> N(s?.discount)>0 || (Array.isArray(s?.items) && s.items.some(isDiscountItem));

/* ========== API ========== */
async function fetchSales(params, signal){
  const { data } = await api.get("/api/sales", { params, signal });
  return Array.isArray(data?.data) ? data.data : data;
}
async function fetchStores(signal){
  try{ const { data } = await api.get("/api/store-locations", { params: { per_page:100 }, signal }); return Array.isArray(data?.data)?data.data:data; }catch{ return []; }
}

/* ========== Page ========== */
export default function HomePage(){
  // filters
  const todayISO = new Date().toISOString().slice(0,10);
  const sevenISO = new Date(Date.now()-6*86400000).toISOString().slice(0,10);

  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState(sevenISO);
  const [to, setTo]     = React.useState(todayISO);
  const [storeId, setStoreId] = React.useState("");
  const [onlyDiscount, setOnlyDiscount] = React.useState(false);

  // data
  const storesQ = useQuery({ queryKey:["stores"], queryFn:({signal})=>fetchStores(signal), staleTime:5*60_000 });
  const salesQ  = useQuery({
    queryKey:["sales",{search,from,to,storeId,onlyDiscount}],
    queryFn:({signal})=>fetchSales({ search, from, to, store_location_id: storeId||undefined, only_discount: onlyDiscount||undefined }, signal),
    keepPreviousData:true, staleTime:60_000
  });

  const salesRaw = salesQ.data || [];

  // FE filter fallback (selain tanggal) — dipakai untuk current range & previous range
  const filterNonDate = React.useCallback((s)=>{
    if (storeId){
      const sl = s?.cashier?.store_location || s?.cashier?.storeLocation;
      const sid = sl?.id ?? s?.store_location_id ?? null;
      if (String(sid||"") !== String(storeId)) return false;
    }
    if (onlyDiscount && !isDiscountSale(s)) return false;
    if (search){
      const hay = `${s?.code||""} ${s?.customer_name||""} ${(s?.cashier?.name||"")} ${JSON.stringify(s?.items||[])}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  },[storeId, onlyDiscount, search]);

  // sales in range
  const rangeSales = React.useMemo(()=>{
    const fromTs = from? new Date(from+"T00:00:00").getTime() : -Infinity;
    const toTs   = to  ? new Date(to+"T23:59:59").getTime()   :  Infinity;
    return salesRaw.filter((s)=>{
      const t = new Date(s?.created_at || s?.createdAt || Date.now()).getTime();
      if (t<fromTs || t>toTs) return false;
      return filterNonDate(s);
    });
  },[salesRaw, from, to, filterNonDate]);

  // previous range (untuk delta % vs periode sebelumnya)
  const prevFrom = React.useMemo(()=>{
    const start = new Date(from+"T00:00:00");
    const end   = new Date(to+"T23:59:59");
    const lenMs = end - start + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lenMs + 1);
    return { start:prevStart, end:prevEnd };
  },[from,to]);

  const prevSales = React.useMemo(()=>{
    return salesRaw.filter((s)=>{
      const t = new Date(s?.created_at || s?.createdAt || Date.now()).getTime();
      if (!(t>=prevFrom.start.getTime() && t<=prevFrom.end.getTime())) return false;
      return filterNonDate(s);
    });
  },[salesRaw, prevFrom, filterNonDate]);

  // aggregations for range & prev
  const aggRange = React.useMemo(()=>aggregateForRange(rangeSales),[rangeSales]);
  const aggPrev  = React.useMemo(()=>aggregateForRange(prevSales),[prevSales]);

  const delta = (now, prev)=> (prev>0 ? ((now-prev)/prev)*100 : null);

  return (
    <div className="mx-auto w-full px-4 md:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-slate-900">Dashboard</h1>
        <button onClick={()=>salesQ.refetch()} className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">Refresh</button>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border bg-white shadow-sm p-3 md:p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label className="block text-xs text-slate-600 mb-1">Search</label>
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
              <span className="text-slate-500">🔍</span>
              <input value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full outline-none text-sm" placeholder="Cari transaksi/produk/kasir" />
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <FieldDate label="Dari" value={from} onChange={setFrom}/>
            <FieldDate label="Sampai" value={to} onChange={setTo}/>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs text-slate-600 mb-1">Toko</label>
            <select className="w-full rounded-lg border px-2 py-2 text-sm" value={storeId} onChange={(e)=>setStoreId(e.target.value)}>
              <option value="">Semua Cabang</option>
              {(storesQ.data||[]).map((s)=>(<option key={s.id} value={s.id}>{s.name}{s.code?` (${s.code})`:""}</option>))}
            </select>
          </div>
          <div className="lg:col-span-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-purple-600" checked={onlyDiscount} onChange={(e)=>setOnlyDiscount(e.target.checked)} />
              Hanya diskon
            </label>
            <button className="ml-auto px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
              onClick={()=>{ setSearch(""); setFrom(sevenISO); setTo(todayISO); setStoreId(""); setOnlyDiscount(false); }}>
              Reset
            </button>
          </div>
          <div className="lg:col-span-1 text-right text-[12px] text-slate-500">{salesQ.isFetching ? "Memuat…" : null}</div>
        </div>
      </div>

      {/* KPI range-aware */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTint title="Revenue (Range)" value={IDR(aggRange.revenue)} badge={fmtDelta(delta(aggRange.revenue, aggPrev.revenue))} tint="bg-purple-50" icon="💰"
                 caption={`${from} s/d ${to}`}/>
        <KpiTint title="Transaksi" value={aggRange.tx} badge={fmtDelta(delta(aggRange.tx, aggPrev.tx))} tint="bg-blue-50" icon="🧾" caption="vs periode sebelumnya"/>
        <KpiTint title="AOV" value={IDR(aggRange.aov)} badge={fmtDelta(delta(aggRange.aov, aggPrev.aov))} tint="bg-pink-50" icon="🛒" caption="vs periode sebelumnya"/>
        <KpiTint title="Diskon Diberikan" value={IDR(aggRange.discounts)} badge={fmtDelta(delta(aggRange.discounts, aggPrev.discounts))} tint="bg-amber-50" icon="🏷️"
                 caption={`${(aggRange.discountRate*100).toFixed(1)}% trx pakai diskon`}/>
      </div>

      {/* Trend + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Trend Penjualan — Diskon vs Non-Diskon" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={aggRange.trendStacked} margin={{ top:10, right:20, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={shortIDR} />
                <Tooltip formatter={(v)=>IDR(v)} />
                <Legend />
                <Area type="monotone" dataKey="non_discount" name="Non-Diskon" stackId="1" stroke="#7C3AED" fill="#E9D5FF"/>
                <Area type="monotone" dataKey="discount"     name="Diskon"      stackId="1" stroke="#F97316" fill="#FED7AA"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Payment Mix">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={aggRange.paymentMix} dataKey="amount" nameKey="method" outerRadius={110} label>
                  {aggRange.paymentMix.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v)=>IDR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* TABLES: Produk Terlaris & Produk Diskon Terlaris */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Produk Terlaris (Qty)">
          <DataTable rows={aggRange.topProducts} columns={[
            {key:"rank", label:"#", w:"w-10"},
            {key:"name", label:"Produk"},
            {key:"qty", label:"Qty", align:"right"},
            {key:"revenue", label:"Revenue", render:(v)=>IDR(v), align:"right"},
            {key:"share", label:"Share", render:(v)=>`${v.toFixed(1)}%`, align:"right"},
          ]}/>
        </Card>
        <Card title="Produk Dengan Diskon Terlaris (Qty)">
          <DataTable rows={aggRange.topDiscountedProducts} columns={[
            {key:"rank", label:"#", w:"w-10"},
            {key:"name", label:"Produk"},
            {key:"qty", label:"Qty", align:"right"},
            {key:"revenue", label:"Revenue", render:(v)=>IDR(v), align:"right"},
            {key:"discount_used", label:"% Trx Diskon", render:(v)=>`${v.toFixed(1)}%`, align:"right"},
          ]}/>
        </Card>
      </div>

      {/* Recent activities & orders (ringkas, tetap ada) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Recent Activities">
          <ul className="space-y-3">
            {aggRange.activities.slice(0,8).map((a,i)=>(
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                <div>
                  <div className="text-[13px] font-medium text-slate-800">{a.title}</div>
                  <div className="text-[12px] text-slate-600">{a.desc}</div>
                  <div className="text-[11px] text-slate-500">{new Date(a.time).toLocaleString("id-ID")}</div>
                </div>
              </li>
            ))}
            {aggRange.activities.length===0 && <li className="text-sm text-slate-500">Belum ada aktivitas.</li>}
          </ul>
        </Card>
        <Card title="Transaksi Terbaru">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-2">Invoice</th>
                <th className="py-2 pr-2">Waktu</th>
                <th className="py-2 pr-2">Kasir</th>
                <th className="py-2 pr-2">Toko</th>
                <th className="py-2 pr-2">#Item</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Metode</th>
              </tr></thead>
              <tbody>
                {aggRange.recentSales.slice(0,12).map((s)=> {
                  const sl = s?.cashier?.store_location || s?.cashier?.storeLocation;
                  const store = sl?.name || "-";
                  const items = Array.isArray(s?.items)?s.items:[];
                  const pays = Array.isArray(s?.payments)?s.payments:[];
                  return (
                    <tr key={s.id} className="border-b last:border-none">
                      <td className="py-2 pr-2 font-medium">{s.code || s.id}</td>
                      <td className="py-2 pr-2">{new Date(s.created_at||Date.now()).toLocaleString("id-ID")}</td>
                      <td className="py-2 pr-2">{s?.cashier?.name || "-"}</td>
                      <td className="py-2 pr-2">{store}</td>
                      <td className="py-2 pr-2 text-right">{items.reduce((a,it)=>a+N(it?.qty ?? it?.quantity ?? 1),0)}</td>
                      <td className="py-2 pr-2 text-right">{IDR(N(s.total))}</td>
                      <td className="py-2 pr-2">{pays.map(p=>p?.method).filter(Boolean).join(", ") || "-"}</td>
                    </tr>
                  );
                })}
                {aggRange.recentSales.length===0 && (<tr><td colSpan={7} className="py-3 text-center text-slate-500">Tidak ada transaksi.</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ========== UI bits ========== */
function FieldDate({ label, value, onChange }){
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      <input type="date" className="w-full rounded-lg border px-2 py-2 text-sm" value={value} onChange={(e)=>onChange(e.target.value)} />
    </label>
  );
}
function Card({ title, className="", children }){
  return (
    <div className={`rounded-2xl border bg-white shadow-sm p-4 ${className}`}>
      <div className="text-sm font-semibold text-slate-800 mb-2">{title}</div>
      {children}
    </div>
  );
}
function KpiTint({ title, value, badge, caption, tint="bg-slate-50", icon="" }){
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${tint}`}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-slate-600">{title}</div>
        <Badge value={badge}/>
      </div>
      <div className="mt-1 text-[22px] font-bold text-slate-900">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-500">
        {icon ? <span className="opacity-70">{icon}</span> : null}
        {caption ? <span>{caption}</span> : null}
      </div>
    </div>
  );
}
function Badge({ value }){
  if (value==null) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">n/a</span>;
  const v = Number(value);
  const up = v>=0;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${up?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>
      {up?"↑":"↓"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}
function DataTable({ rows, columns }){
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600 border-b">
            {columns.map((c)=>(
              <th key={c.key} className={`py-2 pr-2 ${c.align==="right"?"text-right":""} ${c.w||""}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length===0 && <tr><td colSpan={columns.length} className="py-3 text-center text-slate-500">Tidak ada data.</td></tr>}
          {rows.map((r,i)=>(
            <tr key={r.key || i} className="border-b last:border-none">
              {columns.map((c,ci)=>{
                let val = r[c.key];
                if (c.key==="rank") val = i+1;
                if (c.render) val = c.render(val, r);
                return <td key={ci} className={`py-2 pr-2 ${c.align==="right"?"text-right":""}`}>{val}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========== Aggregation for selected range ========== */
function aggregateForRange(sales){
  // KPI
  let revenue=0, tx=0, discounts=0, items=0;
  const byDate = {};
  const payMix = {};
  const activities = [];
  const recentSales = [...sales].sort((a,b)=> (a.created_at>b.created_at? -1:1));

  // Product maps
  const byProduct = {};              // all sales
  const byProductDiscounted = {};    // items sold WITH discount

  for (const s of sales){
    const total = N(s?.total);
    const dt = new Date(s?.created_at || Date.now());
    const dKey = dayKey(dt);
    const itemsArr = Array.isArray(s?.items)? s.items : [];

    revenue += total; tx += 1; discounts += N(s?.discount);
    items   += itemsArr.reduce((a,it)=> a + N(it?.qty ?? it?.quantity ?? 1), 0);

    byDate[dKey] ||= { date:dKey, discount:0, non_discount:0 };
    if (isDiscountSale(s)) byDate[dKey].discount += total; else byDate[dKey].non_discount += total;

    const pays = Array.isArray(s?.payments)? s.payments : [];
    if (pays.length===0) payMix["Unknown"] = (payMix["Unknown"]||0) + total;
    else for (const p of pays) payMix[p?.method||"Unknown"] = (payMix[p?.method||"Unknown"]||0) + N(p?.amount);

    // Activities ringkas
    activities.push({
      time: s?.created_at || new Date().toISOString(),
      title: String(s?.status||"normal").toLowerCase()==="refund" ? "Refund diproses" : "Transaksi berhasil",
      desc: `${s?.cashier?.name || "Kasir"} · ${s?.code || s?.id} · ${IDR(total)}`,
    });

    // Products
    for (const it of itemsArr){
      const name = it?.product?.name || it?.name || `#${it?.product_id ?? it?.id ?? "?"}`;
      const qty  = N(it?.qty ?? it?.quantity ?? 1);
      const line = N(it?.line_total ?? it?.subtotal ?? N(it?.price)*qty);

      byProduct[name] ||= { key:name, name, qty:0, revenue:0 };
      byProduct[name].qty += qty; byProduct[name].revenue += line;

      if (isDiscountItem(it) || N(s?.discount)>0){
        byProductDiscounted[name] ||= { key:name, name, qty:0, revenue:0, used:0, trx:0 };
        byProductDiscounted[name].qty += qty; byProductDiscounted[name].revenue += line;
        byProductDiscounted[name].used += 1;
      }
    }
  }

  const aov = tx ? revenue/tx : 0;
  const discountRate = tx ? (sales.filter(isDiscountSale).length/tx) : 0;

  const trendStacked = Object.values(byDate).sort((a,b)=> (a.date<b.date?-1:1));
  const paymentMix = Object.entries(payMix).map(([method,amount])=>({method,amount}));

  // Top products (by Qty)
  const prodArr = Object.values(byProduct).sort((a,b)=> b.qty - a.qty).slice(0,10);
  const topProducts = prodArr.map((p)=> ({ ...p, share: revenue? (p.revenue/revenue*100):0 }));

  // Top discounted products (by Qty)
  const discArr = Object.values(byProductDiscounted).sort((a,b)=> b.qty - a.qty).slice(0,10);
  const topDiscountedProducts = discArr.map((p)=> ({ ...p, discount_used: tx? (p.used/tx*100):0 }));

  return {
    revenue, tx, discounts, aov, discountRate,
    trendStacked, paymentMix,
    activities, recentSales,
    topProducts, topDiscountedProducts,
  };
}

/* ========== helpers ========== */
function fmtDelta(d){ return d==null ? null : d; }
