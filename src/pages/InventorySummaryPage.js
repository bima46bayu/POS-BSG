// src/pages/InventorySummaryPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Tag } from "lucide-react";
import { getProductSummary, getProductLogs } from "../api/inventory";
import DataTable from "../components/data-table/DataTable";

const PER_PAGE = 10;

const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d) ? "-" : d.toLocaleDateString("id-ID");
};

const fallbackDirection = (refType) => {
  const t = String(refType || "").toUpperCase();
  if (t === "SALE" || t === "DESTROY") return -1;
  if (t === "GR" || t === "ADD" || t === "SALE_VOID") return +1;
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

/** Row kecil label kiri - value kanan */
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[inset_0_0_0_9999px_rgba(248,250,252,0.65)]">
    <span className="text-[12px] leading-5 text-slate-600">{label}</span>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

/** CARD BESAR: Product Summary (full width, 2 kolom) */
const ProductSummaryCard = ({
  productName,
  sku,
  period,
  stockBeginning,
  stockIn,
  stockOut,
  stockEnding,
  costBeginning,
  costIn,
  costOut,
  costEnding,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* dekorasi latar (di belakang konten) */}
      <div className="pointer-events-none absolute -top-16 -left-20 h-72 w-72 rounded-full bg-slate-50 opacity-70" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-slate-50 opacity-70" />

      {/* HEADER */}
      <div className="relative z-10 p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <Tag className="w-5 h-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-500">Product Summary</div>
            <div className="text-[18px] md:text-[20px] font-semibold text-slate-900 truncate">
              {productName}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-white/80">SKU: {sku}</span>
              {period?.from || period?.to ? (
                <span>Periode: {period.from ?? "—"} s.d. {period.to ?? "—"}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-4 h-px w-full bg-slate-200" />
      </div>

      {/* BODY */}
      <div className="relative z-10 px-5 pb-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STOCK SUMMARY */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Stock Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Stock Beginning" value={fmtNum(stockBeginning)} />
              <InfoRow label="Stock In" value={fmtNum(stockIn)} />
              <InfoRow label="Stock Out" value={fmtNum(stockOut)} />
              <InfoRow label="Stock Ending" value={fmtNum(stockEnding)} />
            </div>
          </section>

          {/* COST SUMMARY */}
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Cost Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Cost Beginning" value={fmtIDR(costBeginning)} />
              <InfoRow label="Cost In" value={fmtIDR(costIn)} />
              <InfoRow label="Cost Out" value={fmtIDR(costOut)} />
              <InfoRow label="Cost Ending" value={fmtIDR(costEnding)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default function InventorySummaryPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const productFromState = state?.product || null;

  const [summary, setSummary] = useState({
    stock_in: 0,
    stock_out: 0,
    stock_ending: 0,
    total_cost: 0,
    period: { from: null, to: null },
  });
  const [logs, setLogs] = useState([]);
  const [logsMeta, setLogsMeta] = useState({
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
  });
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getProductSummary(id), getProductLogs(id, { page: logsPage, per_page: PER_PAGE })])
      .then(([sum, lg]) => {
        const norm = {
          stock_in: Number(sum?.qty_in ?? sum?.stock_in ?? 0),
          stock_out: Number(sum?.qty_out ?? sum?.stock_out ?? 0),
          stock_ending: Number(sum?.ending_stock ?? sum?.stock_ending ?? 0),
          total_cost: Number(sum?.stock_cost_total ?? sum?.total_cost ?? 0), // cost ending
          period: sum?.period ?? { from: null, to: null },
        };
        setSummary(norm);

        const items = Array.isArray(lg?.items) ? lg.items : [];
        const normalized = items.map((it) => {
          const ref_type = it.ref_type ?? it.reference_type ?? "-";
          const direction = it.direction ?? fallbackDirection(ref_type);
          const qty = Number(it.qty ?? it.quantity ?? 0);
          const unit_cost = Number(it.unit_cost ?? it.unit_landed_cost ?? it.cost ?? 0);
          const unit_price = Number(it.unit_price ?? it.price ?? 0);
          const subtotal_cost = Number(it.subtotal_cost ?? it.total_cost ?? qty * unit_cost);
          const signedCost = subtotal_cost * Number(direction || 0);
          return {
            ...it,
            _date: it.date ?? it.created_at ?? it.createdAt ?? null,
            _ref_type: ref_type,
            _qty: qty,
            _unit_cost: unit_cost,
            _unit_price: unit_price,
            _subtotal_cost: subtotal_cost,
            _signed_cost: signedCost,
          };
        });

        setLogs(normalized);
        setLogsMeta(
          lg?.meta || {
            current_page: logsPage,
            per_page: PER_PAGE,
            total: normalized.length,
            last_page: 1,
          }
        );
      })
      .finally(() => setLoading(false));
  }, [id, logsPage]);

  useEffect(() => {
    load();
  }, [load]);

  const headerName = productFromState?.name || `Product #${id}`;
  const headerSKU = productFromState?.sku || "-";

  // perhitungan ringkasan
  const stockBeginning = useMemo(
    () => Number(summary.stock_ending || 0) - Number(summary.stock_in || 0) + Number(summary.stock_out || 0),
    [summary.stock_ending, summary.stock_in, summary.stock_out]
  );

  const { costIn, costOut } = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const r of logs) {
      if ((r?._signed_cost ?? 0) > 0) inSum += r._signed_cost;
      else if ((r?._signed_cost ?? 0) < 0) outSum += Math.abs(r._signed_cost);
    }
    return { costIn: inSum, costOut: outSum };
  }, [logs]);

  const costEnding = Number(summary.total_cost || 0);
  const costBeginning = useMemo(
    () => costEnding - Number(costIn || 0) + Number(costOut || 0),
    [costEnding, costIn, costOut]
  );

  // tabel
  const columns = useMemo(
    () => [
      { header: "Tanggal", width: "140px", cell: (r) => <span>{fmtDate(r._date)}</span> },
      {
        header: "Ref Type",
        width: "120px",
        cell: (r) => (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${refTypeClass(r._ref_type)}`}>
            {String(r._ref_type || "-").toUpperCase()}
          </span>
        ),
      },
      { header: "Quantity", width: "100px", align: "right", cell: (r) => <span>{fmtNum(r._qty)}</span> },
      { header: "Unit Cost", width: "120px", align: "right", cell: (r) => <span>{fmtIDR(r._unit_cost)}</span> },
      { header: "Unit Price", width: "120px", align: "right", cell: (r) => <span>{fmtIDR(r._unit_price)}</span> },
      {
        header: "Total Cost (±)",
        width: "160px",
        align: "right",
        cell: (r) => <span className="font-medium">{fmtIDR(r._signed_cost)}</span>,
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
        {/* FULL WIDTH PRODUCT SUMMARY */}
        <ProductSummaryCard
          productName={headerName}
          sku={headerSKU}
          period={summary.period}
          stockBeginning={stockBeginning}
          stockIn={summary.stock_in}
          stockOut={summary.stock_out}
          stockEnding={summary.stock_ending}
          costBeginning={costBeginning}
          costIn={costIn}
          costOut={costOut}
          costEnding={costEnding}
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
              Menampilkan {logsMeta?.per_page ?? PER_PAGE} per halaman • Total {fmtNum(logsMeta?.total ?? 0)}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={logs}
            loading={loading}
            meta={logsMeta}
            currentPage={logsPage}
            onPageChange={setLogsPage}
            stickyHeader
          />
        </div>
      </div>
    </div>
  );
}
