// src/pages/InventorySummaryPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Tag } from "lucide-react";
import { getProductSummary, getProductLogs } from "../api/inventory";
import DataTable from "../components/data-table/DataTable";

const PER_PAGE = 10;
const MAX_PAGES = 200;

const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d) ? "-" : d.toLocaleDateString("id-ID");
};

// ARAH NORMALISASI: SALE/DESTROY = keluar (-1); SALE_VOID/GR/ADD = masuk (+1)
const fallbackDirection = (refType) => {
  const t = String(refType || "").toUpperCase();
  if (t === "SALE" || t === "DESTROY") return -1;               // keluar
  if (t === "SALE_VOID" || t === "GR" || t === "ADD") return +1; // masuk (void return & inbound)
  return 1;
};

const refTypeClass = (t) => {
  const k = String(t || "").toUpperCase();
  if (k === "SALE") return "bg-red-100 text-red-700";
  if (k === "GR" || k === "ADD") return "bg-emerald-100 text-emerald-700";
  if (k === "DESTROY") return "bg-gray-200 text-gray-700";
  if (k === "SALE_VOID") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[inset_0_0_0_9999px_rgba(248,250,252,0.65)]">
    <span className="text-[12px] leading-5 text-slate-600">{label}</span>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

const ProductSummaryCard = ({
  productName, sku, period,
  stockBeginning, stockIn, stockOut, stockEnding,
  costBeginning, costIn, costOut, costEnding,
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="pointer-events-none absolute -top-16 -left-20 h-72 w-72 rounded-full bg-slate-50 opacity-70" />
    <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-slate-50 opacity-70" />
    <div className="relative z-10 p-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
          <Tag className="w-5 h-5 text-slate-700" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-slate-500">Product Summary</div>
          <div className="text-[18px] md:text-[20px] font-semibold text-slate-900 truncate">{productName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-white/80">SKU: {sku}</span>
            {period?.from || period?.to ? <span>Periode: {period.from ?? "—"} s.d. {period.to ?? "—"}</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-4 h-px w-full bg-slate-200" />
    </div>
    <div className="relative z-10 px-5 pb-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Stock Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Stock Beginning" value={fmtNum(stockBeginning)} />
            <InfoRow label="Stock In (GR)" value={fmtNum(stockIn)} />
            <InfoRow label="Stock Out" value={fmtNum(stockOut)} />
            <InfoRow label="Stock Ending" value={fmtNum(stockEnding)} />
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Cost Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Cost Beginning" value={fmtIDR(costBeginning)} />
            <InfoRow label="Cost In (GR)" value={fmtIDR(costIn)} />
            <InfoRow label="Cost Out" value={fmtIDR(costOut)} />
            <InfoRow label="Cost Ending" value={fmtIDR(costEnding)} />
          </div>
        </section>
      </div>
    </div>
  </div>
);

// ===== Helpers =====
function sortLogsAsc(rows) {
  return [...rows].sort((a, b) => {
    const da = new Date(a._date || 0).getTime();
    const db = new Date(b._date || 0).getTime();
    if (da !== db) return da - db;
    const ia = Number(a.id || a._idx || 0);
    const ib = Number(b.id || b._idx || 0);
    return ia - ib;
  });
}

/** Running balance berdasarkan opening dari API */
function addRunningBalances(rows, startQty, startCost) {
  let unitBal = Number(startQty || 0);
  let costBal = Number(startCost || 0);
  const asc = sortLogsAsc(rows);

  return asc.map((r, i) => {
    const isOpening = Boolean(r._is_opening) || String(r._ref_type || "").toUpperCase() === "ADD";

    // delta yang memengaruhi balance
    const dQty = isOpening ? 0 : Number(r._signed_qty || 0);
    const dCost = isOpening ? 0 : Number(r._signed_cost || 0);

    unitBal += dQty;
    costBal += dCost;

    // tampilan (±) : opening tampilkan qty & cost aslinya
    const shownQty = isOpening ? Number(r._qty || 0) : dQty;
    const shownCost = isOpening ? Number(r._subtotal_cost || 0) : dCost;

    return {
      ...r,
      _idx: i,
      _display_qty: shownQty,
      _display_cost: shownCost,
      _unit_balance_after: unitBal,
      _cost_balance_after: costBal,
    };
  });
}

export default function InventorySummaryPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const productFromState = state?.product || null;

  const [period, setPeriod] = useState({ from: null, to: null });
  const [allLogs, setAllLogs] = useState([]);
  const [summary, setSummary] = useState({
    stockBeginning: 0, stockIn: 0, stockOut: 0, stockEnding: 0,
    costBeginning: 0, costIn: 0, costOut: 0, costEnding: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Ambil period + summary API + semua logs
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, first] = await Promise.all([
        getProductSummary(id),
        getProductLogs(id, { page: 1, per_page: PER_PAGE }),
      ]);
      setPeriod(sum?.period ?? { from: null, to: null });

      // mapping dari API
      const openingQty   = Number(sum?.opening_qty ?? 0);
      const openingCost  = Number(sum?.opening_cost ?? 0);
      const qtyIn        = Number(sum?.qty_in ?? 0);   // GR only
      const qtyOut       = Number(sum?.qty_out ?? 0);  // SALE valid + DESTROY
      const costIn       = Number(sum?.cost_in ?? 0);  // GR only
      const costOut      = Number(sum?.cost_out ?? 0); // SALE valid + DESTROY

      // hitung vs fallback dari API
      const stockEnding  = openingQty + qtyIn - qtyOut;
      const costEnding   = sum?.stock_cost_total != null
        ? Number(sum.stock_cost_total)
        : (openingCost + costIn - costOut);

      setSummary({
        stockBeginning: openingQty,
        stockIn: qtyIn,
        stockOut: qtyOut,
        stockEnding,
        costBeginning: openingCost,
        costIn,
        costOut,
        costEnding,
      });

      // --- Normalisasi logs (untuk tabel & running balance) ---
      const normalize = (items) =>
        (Array.isArray(items) ? items : []).map((it) => {
          const ref_type = it.ref_type ?? it.reference_type ?? "-";
          const dir = it.direction != null ? Number(it.direction) : fallbackDirection(ref_type);

          const qty = Number(it.qty ?? it.quantity ?? 0);
          const unit_cost = Number(it.unit_cost ?? it.unit_landed_cost ?? it.cost ?? 0);
          const unit_price = Number(it.unit_price ?? it.price ?? 0);
          const subtotal_cost = Number(it.subtotal_cost ?? it.total_cost ?? qty * unit_cost);

          return {
            ...it,
            _date: it.date ?? it.created_at ?? it.createdAt ?? null,
            _ref_type: ref_type,
            _qty: qty,
            _unit_cost: unit_cost,
            _unit_price: unit_price,
            _subtotal_cost: subtotal_cost,
            _signed_qty: qty * dir,                 // SALE_VOID => +qty
            _signed_cost: subtotal_cost * dir,      // SALE_VOID => +cost
            _is_opening: false, // opening berasal dari summary API
          };
        });

      let merged = normalize(first?.items);
      const lastPage = Number(first?.meta?.last_page ?? 1);
      const tasks = [];
      for (let p = 2; p <= Math.min(lastPage, MAX_PAGES); p++) {
        tasks.push(getProductLogs(id, { page: p, per_page: PER_PAGE }).then((res) => normalize(res?.items)));
      }
      if (tasks.length) {
        const pages = await Promise.all(tasks);
        for (const arr of pages) merged = merged.concat(arr);
      }
      setAllLogs(merged);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const headerName = productFromState?.name || `Product #${id}`;
  const headerSKU  = productFromState?.sku || "-";

  // Running balance start dari opening summary API
  const logsWithBalances = useMemo(() => {
    return addRunningBalances(allLogs, summary.stockBeginning, summary.costBeginning);
  }, [allLogs, summary.stockBeginning, summary.costBeginning]);

  // Slice tabel
  const tableRows = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    return logsWithBalances.slice(start, end);
  }, [logsWithBalances, currentPage]);

  const meta = useMemo(() => {
    const total = logsWithBalances.length;
    return {
      current_page: currentPage,
      per_page: PER_PAGE,
      total,
      last_page: Math.max(1, Math.ceil(total / PER_PAGE)),
    };
  }, [logsWithBalances.length, currentPage]);

  // Kolom: Qty±, Unit Balance, Unit Cost, Cost Balance, Total Cost±
  const columns = useMemo(
    () => [
      { header: "Tanggal", width: "140px", cell: (r) => <span>{fmtDate(r._date)}</span> },
      {
        header: "Ref Type",
        width: "150px",
        cell: (r) => {
          const ref = String(r._ref_type || "-").toUpperCase();
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${refTypeClass(ref)}`}>
              {ref}
              {ref === "SALE_VOID" && <span className="ml-1 text-[10px] opacity-70">(Void Return)</span>}
            </span>
          );
        },
      },
      {
        header: "Qty (±)",
        width: "110px",
        align: "right",
        cell: (r) => {
          const v = Number(r._display_qty ?? 0);
          const cls = v < 0 ? "text-red-600" : v > 0 ? "text-emerald-600" : "text-slate-700";
          const sign = v > 0 ? "+" : "";
          return <span className={`font-medium ${cls}`}>{sign}{fmtNum(v)}</span>;
        },
      },
      {
        header: "Unit Balance",
        width: "130px",
        align: "right",
        cell: (r) => <span className="font-semibold">{fmtNum(r._unit_balance_after)}</span>,
      },
      {
        header: "Unit Cost",
        width: "120px",
        align: "right",
        cell: (r) => <span>{fmtIDR(r._unit_cost)}</span>,
      },
      {
        header: "Cost Balance",
        width: "160px",
        align: "right",
        cell: (r) => <span className="font-semibold">{fmtIDR(r._cost_balance_after)}</span>,
      },
      {
        header: "Total Cost (±)",
        width: "160px",
        align: "right",
        cell: (r) => <span className="font-medium">{fmtIDR(Number(r._display_cost || 0))}</span>,
      },
    ],
    []
  );

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* Back */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span className="text-sm text-slate-700">Kembali</span>
          </button>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">Product ID: {id}</div>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5">
        <ProductSummaryCard
          productName={headerName}
          sku={headerSKU}
          period={period}
          stockBeginning={summary.stockBeginning}
          stockIn={summary.stockIn}
          stockOut={summary.stockOut}
          stockEnding={summary.stockEnding}
          costBeginning={summary.costBeginning}
          costIn={summary.costIn}
          costOut={summary.costOut}
          costEnding={summary.costEnding}
        />

        {/* LOGS */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-slate-50 border border-slate-200">
                <ClipboardList className="w-4 h-4 text-slate-700" />
              </div>
              <div className="font-semibold text-slate-900">Stock Logs</div>
            </div>
            <div className="text-xs text-slate-500">
              Menampilkan {PER_PAGE} per halaman • Total {fmtNum(meta?.total ?? 0)}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableRows}
            loading={loading}
            meta={meta}
            currentPage={meta.current_page}
            onPageChange={setCurrentPage}
            stickyHeader
          />
        </div>
      </div>
    </div>
  );
}
