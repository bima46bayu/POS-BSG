// src/pages/InventorySummaryPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Tag, Download, ArrowUpDown } from "lucide-react";
import toast from "react-hot-toast";

import { getProductSummary, getProductLogs } from "../api/inventory";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { canSwitchStores } from "../utils/roles";
import DataTable from "../components/data-table/DataTable";
import ExportPdfModal from "../components/common/ExportPdfModal";
import { exportStockCardPdf } from "../lib/exportStockCardPdf";
import { IDR as fmtIDR } from "../lib/fmt";

/* ===================== Konstanta ===================== */
const PER_PAGE = 10;
const MAX_PAGES = 200;
const STORAGE_KEY = "inventory_store_id";

/* ===================== Formatter ===================== */
const fmtNum = (n) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};
const fmtQtyUom = (n, uom) => {
  const qty = fmtNum(n);
  const unit = String(uom || "").trim();
  return unit && unit !== "-" ? `${qty} ${unit}` : qty;
};
const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d) ? "-" : d.toLocaleDateString("id-ID");
};
const toYMD = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d)) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/* ===== Stock UOM ↔ smallest UOM (Kg↔g, L↔Ml) ===== */
const UOM_MODE_KEY = "stock_logs_uom_mode"; // "stock" | "smallest"

function normalizeUnitKey(name) {
  const key = String(name || "")
    .trim()
    .toLowerCase();
  const map = {
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    g: "g",
    gr: "g",
    gram: "g",
    grams: "g",
    l: "l",
    liter: "l",
    litre: "l",
    ltr: "l",
    ml: "ml",
    milliliter: "ml",
    millilitre: "ml",
  };
  return map[key] || key;
}

/** Display label for a canonical unit key, preferring the product's own spelling. */
function unitDisplayLabel(canonicalKey, stockLabel) {
  const stockKey = normalizeUnitKey(stockLabel);
  if (stockKey === canonicalKey && stockLabel) return String(stockLabel).trim();
  const defaults = { kg: "Kg", g: "g", l: "L", ml: "Ml" };
  return defaults[canonicalKey] || canonicalKey;
}

/**
 * @returns {{ stockKey: string, smallestKey: string, factorToSmallest: number } | null}
 * factorToSmallest: multiply stock-qty by this to get smallest-qty (e.g. Kg→g = 1000).
 */
function resolveUomPair(stockUom) {
  const stockKey = normalizeUnitKey(stockUom);
  if (!stockKey || stockKey === "-") return null;
  if (stockKey === "kg" || stockKey === "g") {
    return { stockKey, smallestKey: "g", factorToSmallest: stockKey === "kg" ? 1000 : 1 };
  }
  if (stockKey === "l" || stockKey === "ml") {
    return { stockKey, smallestKey: "ml", factorToSmallest: stockKey === "l" ? 1000 : 1 };
  }
  return null;
}

/* =========== Arah normalisasi Qty/Cost per Ref Type =========== */
const fallbackDirection = (refType) => {
  const t = String(refType || "").toUpperCase();
  if (t === "SALE" || t === "DESTROY") return -1;               // keluar
  if (t === "SALE_VOID" || t === "GR" || t === "ADD") return +1; // masuk
  if (t === "OPENING") return 0;                                 // opening tidak pengaruh saldo
  return 1;
};

const refTypeClass = (t) => {
  const k = String(t || "").toUpperCase();
  if (k === "SALE") return "bg-red-100 text-red-700";
  if (k === "GR" || k === "ADD") return "bg-emerald-100 text-emerald-700";
  if (k === "DESTROY") return "bg-gray-200 text-gray-700";
  if (k === "SALE_VOID") return "bg-indigo-100 text-indigo-700";
  if (k === "OPENING") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

/* ===================== UI Kecil ===================== */
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[inset_0_0_0_9999px_rgba(248,250,252,0.65)]">
    <span className="text-[12px] leading-5 text-slate-600">{label}</span>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

const ProductSummaryCard = ({
  productName, sku, uom, period,
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
            {uom && uom !== "-" ? (
              <span className="px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-blue-800">
                UOM: {uom}
              </span>
            ) : null}
            {period?.from || period?.to ? <span>Periode: {period.from ?? "—"} s.d. {period.to ?? "—"}</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-4 h-px w-full bg-slate-200" />
    </div>
    <div className="relative z-10 px-5 pb-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Stock Summary{uom && uom !== "-" ? ` (${uom})` : ""}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Stock Beginning" value={fmtQtyUom(stockBeginning, uom)} />
            <InfoRow label="Stock In (GR)" value={fmtQtyUom(stockIn, uom)} />
            <InfoRow label="Stock Out" value={fmtQtyUom(stockOut, uom)} />
            <InfoRow label="Stock Ending" value={fmtQtyUom(stockEnding, uom)} />
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

/* ===================== Helpers Data ===================== */
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

function addRunningBalances(rows, startQty, startCost) {
  let unitBal = Number(startQty || 0);
  let costBal = Number(startCost || 0);
  const asc = sortLogsAsc(rows);

  return asc.map((r, i) => {
    const isOpening = Boolean(r._is_opening) || String(r._ref_type || "").toUpperCase() === "ADD";

    const dQty  = isOpening ? 0 : Number(r._signed_qty || 0);
    const dCost = isOpening ? 0 : Number(r._signed_cost || 0);

    unitBal += dQty;
    costBal += dCost;

    const shownQty  = isOpening ? Number(r._qty || 0) : dQty;
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

/* ===== Deteksi/Parser note ===== */
function isOpeningNote(note) {
  if (!note) return false;
  return /stok\s*awal|stock\s*awal/i.test(String(note));
}
function isDestroyNote(note) {
  if (!note) return false;
  return /\bdestroy\b/i.test(String(note));
}
// "sale #POS-20251016-0007" -> "POS-20251016-0007", "GR GR-202510-0012" -> "GR-202510-0012"
function extractDocNoFromNote(note, refType) {
  const s = String(note || "").trim();
  const t = String(refType || "").toUpperCase();
  if (isOpeningNote(s) || t === "OPENING") return "OPENING";
  if (isDestroyNote(s) || t === "DESTROY") return "DESTROY";

  const mHash = s.match(/#([A-Za-z0-9._-]+)/);
  if (mHash?.[1]) return mHash[1];

  const common = s.match(/\b(POS|GR|PO|SO|DO|INV|ADJ)-[0-9]{4,}(?:-[0-9]+)*\b/i);
  if (common?.[0]) return common[0].toUpperCase();

  const generic = s.match(/\b[A-Z]{2,}-\d{2,}(?:-\d+)*\b/);
  if (generic?.[0]) return generic[0];

  return "-";
}

/* ===== Helpers export range ===== */
function toDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x)) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}
function within(dateStr, fromStr, toStr) {
  const d = toDateOnly(dateStr);
  if (!d) return false;
  const f = fromStr ? toDateOnly(fromStr) : null;
  const t = toStr ? toDateOnly(toStr) : null;
  if (f && d < f) return false;
  if (t && d > t) return false;
  return true;
}
function rebalanceForRange(allRows, globalOpeningQty, globalOpeningCost, fromStr, toStr) {
  const f = fromStr ? new Date(fromStr + "T00:00:00") : null;

  let openingQty = Number(globalOpeningQty || 0);
  let openingCost = Number(globalOpeningCost || 0);

  if (f) {
    for (const r of allRows) {
      const d = r._date ? new Date(r._date) : null;
      if (d && d < f) {
        openingQty += Number(r._signed_qty || 0);
        openingCost += Number(r._signed_cost || 0);
      }
    }
  }

  const inRange = allRows
    .filter((r) => within(r._date, fromStr, toStr))
    .sort((a, b) => new Date(a._date || 0) - new Date(b._date || 0) || (Number(a.id||a._idx||0) - Number(b.id||b._idx||0)));

  let balQty = openingQty;
  let balCost = openingCost;

  const rowsBalanced = inRange.map((r, i) => {
    const shownQty  = Number(r._signed_qty || 0);
    const shownCost = Number(r._signed_cost || 0);
    balQty  += shownQty;
    balCost += shownCost;
    return {
      ...r,
      _idx: i,
      _display_qty: shownQty,
      _display_cost: shownCost,
      _unit_balance_after: balQty,
      _cost_balance_after: balCost,
    };
  });

  return { openingQty, openingCost, rowsBalanced };
}

/* ===================== Halaman ===================== */
export default function InventorySummaryPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const productFromState = state?.product || null;
  const storeIdFromState = state?.storeId ?? null;

  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeFilterId, setStoreFilterId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const canPickStore = useMemo(
    () => canSwitchStores(me?.role, me),
    [me]
  );

  const myStoreId = useMemo(
    () => me?.store_location_id ?? me?.store_location?.id ?? null,
    [me]
  );

  const effectiveStoreId = useMemo(() => {
    if (storeIdFromState != null && storeIdFromState !== "") {
      return Number(storeIdFromState);
    }
    if (!canPickStore) {
      return myStoreId != null ? Number(myStoreId) : null;
    }
    if (storeFilterId) return Number(storeFilterId);
    return null;
  }, [storeIdFromState, canPickStore, myStoreId, storeFilterId]);

  const activeStoreLabel = useMemo(() => {
    if (canPickStore && !effectiveStoreId && !storeIdFromState) return "Pilih cabang";
    const sid = effectiveStoreId;
    if (sid == null) return "-";
    const found = stores.find((s) => String(s.id) === String(sid));
    return found?.name ?? me?.store_location?.name ?? "-";
  }, [canPickStore, effectiveStoreId, storeIdFromState, stores, me]);

  const needsStoreSelection =
    canPickStore && effectiveStoreId == null && !storeIdFromState;

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((profile) => {
        if (cancelled) return;
        setMe(profile);
        if (!canSwitchStores(profile?.role, profile)) {
          const sid =
            profile?.store_location?.id ?? profile?.store_location_id ?? null;
          if (sid != null) setStoreFilterId(String(sid));
        }
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listStoreLocations({ page: 1, per_page: 100 });
        if (!cancelled) setStores(res?.items || []);
      } catch {
        if (!cancelled) setStores([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickStore]);

  useEffect(() => {
    if (!canPickStore || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, storeFilterId || "");
    } catch {
      // ignore
    }
  }, [canPickStore, storeFilterId]);

  const storeParams = useMemo(
    () => (effectiveStoreId != null ? { store_id: effectiveStoreId } : {}),
    [effectiveStoreId]
  );

  const [period, setPeriod] = useState({ from: null, to: null });
  const [allLogs, setAllLogs] = useState([]);
  const [productMeta, setProductMeta] = useState({
    name: productFromState?.name || null,
    sku: productFromState?.sku || null,
    uom:
      productFromState?.unit?.name ||
      productFromState?.unit_name ||
      null,
  });

  const [summary, setSummary] = useState({
    stockBeginning: 0, stockIn: 0, stockOut: 0, stockEnding: 0,
    costBeginning: 0, costIn: 0, costOut: 0, costEnding: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // 'desc' (default terbaru di atas) / 'asc'
  const [sortOrder, setSortOrder] = useState("desc");

  // stock = product UOM (e.g. Kg); smallest = g / Ml when convertible
  const [uomMode, setUomMode] = useState(() => {
    try {
      const v = localStorage.getItem(UOM_MODE_KEY);
      return v === "smallest" ? "smallest" : "stock";
    } catch {
      return "stock";
    }
  });

  const setUomModePersist = (mode) => {
    setUomMode(mode);
    try {
      localStorage.setItem(UOM_MODE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const load = useCallback(async () => {
    if (needsStoreSelection) {
      setAllLogs([]);
      setSummary({
        stockBeginning: 0, stockIn: 0, stockOut: 0, stockEnding: 0,
        costBeginning: 0, costIn: 0, costOut: 0, costEnding: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sum, first] = await Promise.all([
        getProductSummary(id, storeParams),
        getProductLogs(id, { page: 1, per_page: PER_PAGE, ...storeParams }),
      ]);

      setPeriod(sum?.period ?? { from: null, to: null });
      setProductMeta({
        name: sum?.product_name || productFromState?.name || null,
        sku: sum?.sku || productFromState?.sku || null,
        uom:
          sum?.unit_name ||
          productFromState?.unit?.name ||
          productFromState?.unit_name ||
          null,
      });

      const openingQty = Number(sum?.opening_qty ?? 0);

      // Ambil unit-cost pembuka dari beberapa kemungkinan field
      const openingUnitCost =
        Number(
          sum?.opening_unit_cost ??
          sum?.avg_cost ??
          sum?.unit_cost ??
          0
        );

      // Total opening cost (prioritas):
      // 1) opening_cost_total (kalau BE kirim)
      // 2) openingQty * openingUnitCost
      // 3) fallback: opening_cost (jika ternyata itu memang total)
      let openingCostTotal =
        sum?.opening_cost_total != null
          ? Number(sum.opening_cost_total)
          : openingQty * openingUnitCost;
      if (!openingCostTotal && sum?.opening_cost != null) {
        openingCostTotal = Number(sum.opening_cost);
      }

      const qtyIn   = Number(sum?.qty_in ?? 0);
      const qtyOut  = Number(sum?.qty_out ?? 0);
      const costIn  = Number(sum?.cost_in ?? 0);
      const costOut = Number(sum?.cost_out ?? 0);

      const stockEnding = openingQty + qtyIn - qtyOut;
      const costEnding  =
        sum?.stock_cost_total != null
          ? Number(sum.stock_cost_total)
          : (openingCostTotal + costIn - costOut);

      setSummary({
        stockBeginning: openingQty,
        stockIn: qtyIn,
        stockOut: qtyOut,
        stockEnding,
        // Penting: total biaya awal (qty × unit_cost)
        costBeginning: openingCostTotal,
        costIn,
        costOut,
        costEnding,
      });

      const normalize = (items) =>
        (Array.isArray(items) ? items : []).map((it) => {
          const ref_type = it.ref_type ?? it.reference_type ?? "-";

          // opening/destroy dari note atau ref_type
          const opening = isOpeningNote(it.note) || String(ref_type).toUpperCase() === "OPENING";
          const baseDir = it.direction != null ? Number(it.direction) : fallbackDirection(ref_type);
          const dir = opening ? 0 : baseDir;

          const qty           = Number(it.qty ?? it.quantity ?? 0);
          const unit_cost     = Number(it.unit_cost ?? it.unit_landed_cost ?? it.cost ?? 0);
          const unit_price    = Number(it.unit_price ?? it.price ?? 0);
          const subtotal_cost = Number(it.subtotal_cost ?? it.total_cost ?? qty * unit_cost);

          const doc_no = extractDocNoFromNote(it.note, ref_type);

          return {
            ...it,
            _date: it.date ?? it.created_at ?? it.createdAt ?? null,
            _ref_type: ref_type,
            _qty: qty,
            _unit_cost: unit_cost,
            _unit_price: unit_price,
            _subtotal_cost: subtotal_cost,

            _signed_qty: qty * dir,            // opening => 0
            _signed_cost: subtotal_cost * dir, // opening => 0
            _is_opening: opening,

            _doc_no: doc_no,
          };
        });

      let merged = normalize(first?.items);
      const lastPage = Number(first?.meta?.last_page ?? 1);
      const tasks = [];
      for (let p = 2; p <= Math.min(lastPage, MAX_PAGES); p++) {
        tasks.push(
          getProductLogs(id, { page: p, per_page: PER_PAGE, ...storeParams }).then((res) =>
            normalize(res?.items)
          )
        );
      }
      if (tasks.length) {
        const pages = await Promise.all(tasks);
        for (const arr of pages) merged = merged.concat(arr);
      }
      setAllLogs(merged);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [id, storeParams, needsStoreSelection]);

  useEffect(() => { load(); }, [load]);

  const headerName = productMeta.name || productFromState?.name || `Product #${id}`;
  const headerSKU = productMeta.sku || productFromState?.sku || "-";
  const headerUom =
    productMeta.uom ||
    productFromState?.unit?.name ||
    productFromState?.unit_name ||
    "-";

  const uomPair = useMemo(() => resolveUomPair(headerUom), [headerUom]);
  const canToggleSmallest = !!uomPair && uomPair.factorToSmallest !== 1;
  const displayUom = useMemo(() => {
    if (!headerUom || headerUom === "-") return "-";
    if (uomMode === "smallest" && uomPair) {
      return unitDisplayLabel(uomPair.smallestKey, headerUom);
    }
    return String(headerUom).trim();
  }, [headerUom, uomMode, uomPair]);

  const qtyFactor =
    uomMode === "smallest" && uomPair ? uomPair.factorToSmallest : 1;
  // Unit cost is per stock UOM; in smallest view divide by the same factor.
  const costFactor = qtyFactor > 0 ? 1 / qtyFactor : 1;

  // Balance kronologis (ASC)
  const logsWithBalancesAsc = useMemo(() => {
    return addRunningBalances(allLogs, summary.stockBeginning, summary.costBeginning);
  }, [allLogs, summary.stockBeginning, summary.costBeginning]);

  const costEndingFromRows = useMemo(() => {
    return logsWithBalancesAsc.length
      ? logsWithBalancesAsc[logsWithBalancesAsc.length - 1]._cost_balance_after
      : Number(summary.costBeginning || 0);
  }, [logsWithBalancesAsc, summary.costBeginning]);

  // Tampilan sesuai sort
  const logsForDisplay = useMemo(() => {
    return sortOrder === "desc" ? [...logsWithBalancesAsc].reverse() : logsWithBalancesAsc;
  }, [logsWithBalancesAsc, sortOrder]);

  const tableRows = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    return logsForDisplay.slice(start, end);
  }, [logsForDisplay, currentPage]);

  const meta = useMemo(() => {
    const total = logsForDisplay.length;
    return {
      current_page: currentPage,
      per_page: PER_PAGE,
      total,
      last_page: Math.max(1, Math.ceil(total / PER_PAGE)),
    };
  }, [logsForDisplay.length, currentPage]);

  // Kolom halaman (tanpa FIFO Loc)
  const columns = useMemo(
    () => [
      { header: "Tanggal", width: "120px", cell: (r) => <span>{fmtDate(r._date)}</span> },
      {
        header: "Ref Type",
        width: "120px",
        cell: (r) => {
          const ref = String(r._ref_type || "-").toUpperCase();
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${refTypeClass(ref)}`}>
              {ref}
            </span>
          );
        },
      },
      { header: "Doc No", width: "180px", cell: (r) => (
          <span className="font-medium truncate inline-block max-w-[160px]" title={r._doc_no || "-"}>
            {r._doc_no || "-"}
          </span>
      ) },
      {
        header: displayUom && displayUom !== "-" ? `Qty (±) / ${displayUom}` : "Qty (±)",
        width: "130px",
        align: "right",
        cell: (r) => {
          const v = Number(r._display_qty ?? 0) * qtyFactor;
          const cls = v < 0 ? "text-red-600" : v > 0 ? "text-emerald-600" : "text-slate-700";
          const sign = v > 0 ? "+" : "";
          return <span className={`font-medium ${cls}`}>{sign}{fmtQtyUom(v, displayUom)}</span>;
        },
      },
      {
        header: displayUom && displayUom !== "-" ? `Balance / ${displayUom}` : "Unit Balance",
        width: "140px",
        align: "right",
        cell: (r) => (
          <span className="font-semibold">
            {fmtQtyUom(Number(r._unit_balance_after ?? 0) * qtyFactor, displayUom)}
          </span>
        ),
      },
      {
        header: displayUom && displayUom !== "-" ? `Unit Cost / ${displayUom}` : "Unit Cost",
        width: "140px",
        align: "right",
        cell: (r) => <span>{fmtIDR(Number(r._unit_cost ?? 0) * costFactor)}</span>,
      },
      {
        header: "Total Cost (±)",
        width: "160px",
        align: "right",
        cell: (r) => <span className="font-medium">{fmtIDR(Number(r._display_cost || 0))}</span>,
      },
      {
        header: "Cost Balance",
        width: "160px",
        align: "right",
        cell: (r) => <span className="font-semibold">{fmtIDR(r._cost_balance_after)}</span>,
      },
    ],
    [displayUom, qtyFactor, costFactor]
  );

  /* ===================== Export Handler (client-side) ===================== */
  async function handleExportConfirm({ from, to }) {
    setExportLoading(true);
    try {
      const { openingQty, openingCost, rowsBalanced } = rebalanceForRange(
        logsWithBalancesAsc,
        summary.stockBeginning,
        summary.costBeginning,
        from || null,
        to || null
      );

      const pdfRows =
        qtyFactor === 1
          ? rowsBalanced
          : rowsBalanced.map((r) => ({
              ...r,
              _display_qty: Number(r._display_qty ?? 0) * qtyFactor,
              _signed_qty: Number(r._signed_qty ?? 0) * qtyFactor,
              _unit_balance_after: Number(r._unit_balance_after ?? 0) * qtyFactor,
              _unit_cost: Number(r._unit_cost ?? 0) * costFactor,
            }));

      const pdfSummary = {
        stockBeginning: openingQty * qtyFactor,
        stockIn: rowsBalanced.filter(r => Number(r._display_qty||0) > 0)
                             .reduce((a,b)=> a + Number(b._display_qty||0), 0) * qtyFactor,
        stockOut: rowsBalanced.filter(r => Number(r._display_qty||0) < 0)
                              .reduce((a,b)=> a + Math.abs(Number(b._display_qty||0)), 0) * qtyFactor,
        stockEnding: (rowsBalanced.length ? rowsBalanced[rowsBalanced.length-1]._unit_balance_after : openingQty) * qtyFactor,
        costBeginning: openingCost,
        costIn: rowsBalanced.filter(r => Number(r._display_cost||0) > 0)
                            .reduce((a,b)=> a + Number(b._display_cost||0), 0),
        costOut: rowsBalanced.filter(r => Number(r._display_cost||0) < 0)
                             .reduce((a,b)=> a + Math.abs(Number(b._display_cost||0)), 0),
        costEnding: rowsBalanced.length ? rowsBalanced[rowsBalanced.length-1]._cost_balance_after : openingCost,
      };

      exportStockCardPdf({
        company: "PT. BUANA SELARAS GLOBALINDO",
        productName: headerName,
        sku: headerSKU,
        uom: displayUom,
        period: { from: from || period?.from || null, to: to || period?.to || null },
        summary: pdfSummary,
        openingQty: openingQty * qtyFactor,
        openingCost,
        rows: pdfRows,
      });

      toast.success("PDF berhasil dibuat.");
      setExportOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Gagal generate PDF.");
    } finally {
      setExportLoading(false);
    }
  }

  /* ===================== Render ===================== */
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
          {canPickStore && !storeIdFromState ? (
            <div className="flex items-center gap-2">
              <label htmlFor="summary-store" className="text-xs text-slate-600">
                Cabang
              </label>
              <select
                id="summary-store"
                value={storeFilterId}
                onChange={(e) => setStoreFilterId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm min-w-[160px]"
              >
                <option value="">— Pilih cabang —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} — ` : ""}
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              Cabang: <span className="font-medium text-slate-700">{activeStoreLabel}</span>
            </span>
          )}
          <div className="flex-1" />
          <div className="text-xs text-slate-500">Product ID: {id}</div>
        </div>
      </div>

      {needsStoreSelection && (
        <div className="mx-4 md:mx-6 mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Pilih cabang untuk melihat ringkasan stok dan log produk ini.
        </div>
      )}

      <div className="px-4 md:px-6 pt-5">
        <ProductSummaryCard
          productName={headerName}
          sku={headerSKU}
          uom={headerUom}
          period={period}
          stockBeginning={summary.stockBeginning}
          stockIn={summary.stockIn}
          stockOut={summary.stockOut}
          stockEnding={summary.stockEnding}
          costBeginning={summary.costBeginning}
          costIn={summary.costIn}
          costOut={summary.costOut}
          costEnding={costEndingFromRows} 
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

            <div className="flex items-center gap-2">
              {canToggleSmallest && (
                <div
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs"
                  title="Tampilkan Qty & Balance dalam satuan stok atau satuan terkecil"
                >
                  <button
                    type="button"
                    onClick={() => setUomModePersist("stock")}
                    className={`px-2.5 py-1.5 rounded-md font-medium transition ${
                      uomMode === "stock"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {unitDisplayLabel(uomPair.stockKey, headerUom)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUomModePersist("smallest")}
                    className={`px-2.5 py-1.5 rounded-md font-medium transition ${
                      uomMode === "smallest"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {unitDisplayLabel(uomPair.smallestKey, headerUom)}
                  </button>
                </div>
              )}
              <div className="text-xs text-slate-500 hidden md:block pl-1">
                Menampilkan {PER_PAGE} • Total {fmtNum(meta?.total ?? 0)}
              </div>
              {/* Toggle sort ikon */}
              <button
                title={sortOrder === "desc" ? "Urut: Terbaru → Terlama" : "Urut: Terlama → Terbaru"}
                onClick={() => {
                  setSortOrder((v) => (v === "desc" ? "asc" : "desc"));
                  setCurrentPage(1);
                }}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ArrowUpDown className="w-4 h-4 text-slate-700" />
              </button>
              {/* Export PDF */}
              <button
                onClick={() => setExportOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-blue-600 text-white hover:bg-blue-700"
                title="Export PDF"
              >
                <Download className="w-4 h-4" />
              </button>
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

      {/* Export Modal (range tanggal) */}
      <ExportPdfModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onConfirm={handleExportConfirm}
        defaultFrom={period?.from ? toYMD(period.from) : ""}
        defaultTo={period?.to ? toYMD(period.to) : ""}
        loading={exportLoading}
      />
    </div>
  );
}
