import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, X, Search, Filter, Download, XCircle, Eye } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import DataTable from "../data-table/DataTable";
import DateRangePicker from "../DateRangePicker";
import { getSales, getSale, voidSale } from "../../api/sales";
import { getMe } from "../../api/users";
import useAnchoredPopover from "../../lib/useAnchoredPopover";
import ConfirmDialog from "../common/ConfirmDialog";
import SaleDetailModal from "../sales/SaleDetailModal";

const PER_PAGE = 10;

const toNumber = (v) => (v == null ? 0 : Number(v));
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const formatDateTime = (s) => {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
};

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "QRIS", label: "QRIS" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "void", label: "Void" },
];

const normMethodKey = (m) => (m === "QRIS" ? "QRIS" : String(m || "").toLowerCase());
const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isWithinDateRange = (iso, start, end) => {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

export default function HistoryByTransaction() {
  // ===== me / role & stores =====
  const [me, setMe] = useState(null);
  const isAdmin = useMemo(() => String(me?.role || "").toLowerCase() === "admin", [me]);

  // ===== server data & meta =====
  const [rawRows, setRawRows] = useState([]);
  const [serverMeta, setServerMeta] = useState({
    current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0,
  });
  const [loading, setLoading] = useState(false);

  // ===== client states =====
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // general filters
  const [paymentMethod, setPaymentMethod] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState({ start: todayStr(), end: todayStr() });

  // popovers
  const generalBtnRef = useRef(null);
  const storeBtnRef = useRef(null);
  const dateRangeBtnRef = useRef(null);
  const general = useAnchoredPopover();
  const store = useAnchoredPopover();
  const dateRangePopover = useAnchoredPopover();
  useEffect(() => { 
    general.setAnchor(generalBtnRef.current); 
    store.setAnchor(storeBtnRef.current); 
    dateRangePopover.setAnchor(dateRangeBtnRef.current);
  }, [general, store, dateRangePopover]);

  // ===== init: me & stores, set default store =====
  useEffect(() => {
    (async () => {
      try {
        const meRes = await getMe().catch(() => null);
        setMe(meRes);
      } catch {}
    })();
  }, []);

  // ===== detail & reject states =====
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);

  const [refreshTick, setRefreshTick] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState("");

  // ===== IMPORTANT: cashier must always filter on client =====
  const clientFilterActive = useMemo(() => {
    if (!isAdmin) return true; // kasir selalu client-filter
    return Boolean(paymentMethod || dateRange.start || dateRange.end || statusFilter);
  }, [isAdmin, paymentMethod, dateRange.start, dateRange.end, statusFilter]);

  // ===== FETCH LIST =====
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    // admin boleh kirim store_id ke backend (kalau backend support)
    // cashier: tidak kirim apa-apa (kita filter client-side)
    const baseParams = {
      code: searchTerm.trim() || undefined,
      sort: sortKey || undefined,
      dir: sortKey ? sortDir : undefined,
    };

    const params = clientFilterActive
      ? { page: 1, per_page: 100000, ...baseParams }
      : { page: currentPage, per_page: PER_PAGE, ...baseParams };

    getSales(params, controller.signal)
      .then(({ items, meta }) => {
        const rows = items || [];
        setRawRows(rows);
        setServerMeta(
          meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: rows.length }
        );
      })
      .catch((err) => {
        const isCanceled = err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat history transaksi");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    searchTerm,
    sortKey,
    sortDir,
    currentPage,
    clientFilterActive,
    dateRange.start,
    dateRange.end,
    paymentMethod,
    refreshTick,
    isAdmin,
  ]);

  // ===== client-side filter/sort =====
  const filteredSorted = useMemo(() => {
    let list = rawRows;

    if (clientFilterActive) {
      if (paymentMethod) {
        list = list.filter((r) => {
          const fromPayments = Array.isArray(r.payments) ? r.payments.map((p) => normMethodKey(p.method)) : [];
          const single = normMethodKey(r.payment_method || r.method || "");
          const setMethods = new Set([...fromPayments, single].filter(Boolean));
          return setMethods.has(normMethodKey(paymentMethod));
        });
      }

      if (statusFilter) {
        list = list.filter((r) => {
          const v = String(r.status || "").toLowerCase();
          return statusFilter === "void" ? v === "void" : v !== "void";
        });
      }

      if (dateRange.start || dateRange.end)
        list = list.filter((r) => isWithinDateRange(r.created_at, dateRange.start, dateRange.end));

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        list = list.filter((r) => String(r.code || "").toLowerCase().includes(q));
      }

      if (sortKey) {
        const dir = sortDir === "desc" ? -1 : 1;
        list = [...list].sort((a, b) => {
          const va = a[sortKey];
          const vb = b[sortKey];
          if (va == null && vb == null) return 0;
          if (va == null) return -1 * dir;
          if (vb == null) return 1 * dir;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }
    }
    return list;
  }, [
    rawRows,
    clientFilterActive,
    paymentMethod,
    statusFilter,
    dateRange.start,
    dateRange.end,
    searchTerm,
    sortKey,
    sortDir,
  ]);

  // ===== paginate & meta normalize =====
  const { pageRows, meta } = useMemo(() => {
    if (clientFilterActive) {
      const total = filteredSorted.length;
      const per = PER_PAGE;
      const last = Math.max(1, Math.ceil(total / per));
      const curr = Math.min(currentPage, last);
      const startIdx = (curr - 1) * per;
      const endIdx = startIdx + per;
      return {
        pageRows: filteredSorted.slice(startIdx, endIdx),
        meta: { current_page: curr, last_page: last, per_page: per, total },
      };
    }
    const per = serverMeta?.per_page ?? PER_PAGE;
    const total = serverMeta?.total ?? rawRows.length;
    const last = serverMeta?.last_page ?? Math.max(1, Math.ceil(total / Math.max(1, per)));
    const curr = serverMeta?.current_page ?? currentPage;
    return {
      pageRows: rawRows,
      meta: { ...serverMeta, per_page: per, total, last_page: last, current_page: curr },
    };
  }, [clientFilterActive, filteredSorted, rawRows, serverMeta, currentPage]);

  const handleSort = useCallback(
    (key) => {
      if (!key) return;
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortKey(key); setSortDir("asc"); }
      setCurrentPage(1);
    },
    [sortKey]
  );

  const openDetail = useCallback(async (row) => {
    setSelectedSale(row);
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const detail = await getSale(row.id);
      setSaleDetail(detail);
    } catch {
      toast.error("Gagal memuat detail transaksi");
      setShowDetail(false);
      setSelectedSale(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openReject = useCallback((row) => {
    setRejectRow(row);
    setRejectReason("");
    setRejectError("");
    setRejectOpen(true);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectRow?.id) return;
    setRejectLoading(true);
    setRejectError("");
    try {
      await voidSale(rejectRow.id, { reason: rejectReason });
      toast.success("Transaksi berhasil di-void");
      setRejectOpen(false);
      setRejectRow(null);
      setRejectReason("");
      if (showDetail && (selectedSale?.id === rejectRow.id || saleDetail?.id === rejectRow.id)) {
        setShowDetail(false); setSelectedSale(null); setSaleDetail(null);
      }
      // refresh list
      setRawRows((r) => r.filter((x) => x.id !== rejectRow.id));
    } catch (e) {
      const res = e?.response;
      const msg =
        res?.data?.message ||
        (res?.data && typeof res.data === "string" ? res.data : "") ||
        e?.message || "Gagal melakukan void transaksi";

      let fieldErrors = "";
      const errors = res?.data?.errors;
      if (errors && typeof errors === "object") {
        const lines = [];
        Object.entries(errors).forEach(([k, arr]) => {
          const text = Array.isArray(arr) ? arr.join(", ") : String(arr);
          lines.push(`${k}: ${text}`);
        });
        if (lines.length) fieldErrors = lines.join("\n");
      }
      setRejectError([msg, fieldErrors].filter(Boolean).join("\n"));
    } finally {
      setRejectLoading(false);
    }
  }, [rejectRow, rejectReason, showDetail, selectedSale, saleDetail]);

  const PaymentBadge = ({ row }) => {
    const methods =
      Array.isArray(row.payments) && row.payments.length
        ? [...new Set(row.payments.map((p) => normMethodKey(p.method)))]
        : [normMethodKey(row.payment_method || row.method || "-")];

    const styleMap = {
      cash: "bg-green-100 text-green-800 border-green-200",
      card: "bg-blue-100 text-blue-800 border-blue-200",
      ewallet: "bg-purple-100 text-purple-800 border-purple-200",
      transfer: "bg-yellow-100 text-yellow-800 border-yellow-200",
      QRIS: "bg-orange-100 text-orange-800 border-orange-200",
      "-": "bg-gray-100 text-gray-800 border-gray-200",
    };
    const label = (k) =>
      k === "QRIS" ? "QRIS" :
      k === "ewallet" ? "E-Wallet" :
      k === "transfer" ? "Bank Transfer" :
      k.charAt(0).toUpperCase() + k.slice(1);

    return (
      <div className="flex flex-wrap gap-1">
        {methods.map((m, i) => (
          <span key={`${m}-${i}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styleMap[m] || styleMap["-"]}`}>
            {label(m)}
          </span>
        ))}
      </div>
    );
  };

  const CodeCell = ({ row }) => (
    <span className="block whitespace-nowrap truncate max-w-[12rem]" title={row.code || row.number || "-"}>
      {row.code || row.number || "-"}
    </span>
  );

  const DateCell = ({ row }) => (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="block truncate max-w-[12rem]" title={row.created_at}>
        {formatDateTime(row.created_at)}
      </span>
    </div>
  );

  const TextCell = ({ children, title }) => (
    <span className="block whitespace-nowrap truncate max-w-[12rem]" title={title}>
      {children}
    </span>
  );

  const StatusBadge = ({ status }) => {
    const v = String(status || "").toLowerCase();
    const isVoid = v === "void";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
        ${isVoid ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
        {isVoid ? "Void" : "Completed"}
      </span>
    );
  };

  const columns = [
    { key: "code", header: "Transaction", sticky: "left", cell: (row) => <CodeCell row={row} />, className: "font-medium" },
    { key: "created_at", header: "Tanggal", cell: (row) => <DateCell row={row} /> },
    { key: "customer_name", header: "Customer", cell: (row) => <TextCell title={row.customer_name || "General"}>{row.customer_name || "General"}</TextCell> },
    { key: "status", header: "Status", className: "hidden sm:table-cell", cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: "subtotal",
      header: "Sub Total",
      align: "right",
      className: "hidden sm:table-cell",
      cell: (row) => {
      const value =
        row.final_total === null || row.final_total === 0
          ? row.total ?? 0
          : row.final_total;

      return (
        <TextCell title={String(formatIDR(value))}>
          {formatIDR(value)}
        </TextCell>
      );
    },
    },
    {
      key: "paid",
      header: "Pay",
      align: "right",
      className: "hidden md:table-cell",
      cell: (row) => {
        const val = Array.isArray(row.payments) ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0) : row.paid;
        return <TextCell title={String(formatIDR(val))}>{formatIDR(val)}</TextCell>;
      },
    },
    { key: "change", header: "Change", align: "right", className: "hidden lg:table-cell", cell: (row) => <TextCell title={String(formatIDR(row.change))}>{formatIDR(row.change)}</TextCell> },
    { key: "payment_method", header: "Payment", className: "hidden lg:table-cell", cell: (row) => <PaymentBadge row={row} /> },
    {
      key: "__actions",
      header: "Actions",
      sticky: "right",
      className: "sticky right-0 z-20 bg-white w-[84px]",
      cell: (row) => (
        <div className="sticky right-0 z-20 bg-white flex items-center justify-end gap-1 pr-2" style={{ boxShadow: "-6px 0 6px -6px rgba(0,0,0,.12)" }}>
          {row.status !== "void" && (
            <button onClick={() => openReject(row)} className="p-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50" title="Void / Reject transaksi" aria-label="Void transaksi">
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => openDetail(row)} className="p-1.5 rounded-md border bg-blue-600 text-white hover:bg-blue-800" title="Detail transaksi" aria-label="Detail transaksi">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ===== EXPORT EXCEL (pengganti CSV) =====
  const exportExcel = async () => {
    try {
      toast.loading("Menyiapkan Excel...", { id: "exp" });
      const data = clientFilterActive ? filteredSorted : rawRows;

      const rows = (data || []).map((r) => {
        const pay = Array.isArray(r.payments) ? r.payments.reduce((s, p) => s + toNumber(p.amount), 0) : r.paid;
        const methods =
          Array.isArray(r.payments) && r.payments.length
            ? [...new Set(r.payments.map((p) => normMethodKey(p.method)))]
                .map((m) => (m === "QRIS" ? "QRIS" : m === "ewallet" ? "E-Wallet" : m === "transfer" ? "Bank Transfer" : m[0].toUpperCase() + m.slice(1)))
                .join(" | ")
            : r.payment_method || r.method || "-";

        const storeName =
          r?.cashier?.store_location?.name ??
          r?.store_location?.name ??
          r?.store_location_name ??
          "";

        return {
          "Transaction Number": r.code || r.number || "-",
          Tanggal: formatDateTime(r.created_at),
          Customer: r.customer_name || "General",
          Status: r.status === "void" ? "Void" : "Completed",
          "Sub Total": formatIDR(r.final_total),
          Pay: formatIDR(pay),
          Change: formatIDR(r.change),
          "Payment Methods": methods,
          Store: storeName,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "History");

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `history-transactions-${ts}.xlsx`);

      toast.success("Excel berhasil diunduh", { id: "exp" });
    } catch {
      toast.error("Gagal mengekspor Excel", { id: "exp" });
    }
  };

  return (
    <>
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by code..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          
          {/* Date Range Button */}
          <div className="relative">
            <button
              ref={dateRangeBtnRef}
              onClick={() => dateRangePopover.setOpen(!dateRangePopover.open)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4" />
              {dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} - ${dateRange.end}`}
            </button>
            {dateRangePopover.open && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => dateRangePopover.setOpen(false)} />
                <div
                  className="fixed z-50"
                  style={{ top: dateRangePopover.pos.top, left: dateRangePopover.pos.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onStartChange={(d) => setDateRange(p => ({ ...p, start: d }))}
                    onEndChange={(d) => setDateRange(p => ({ ...p, end: d }))}
                    onClose={() => { dateRangePopover.setOpen(false); setCurrentPage(1); }}
                  />
                </div>
              </>
            )}
          </div>

          {/* General filter popover */}
          <div className="relative">
            <button
              ref={generalBtnRef}
              onClick={() => general.setOpen(!general.open)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
              {(paymentMethod || statusFilter) && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {(paymentMethod ? 1 : 0) + (statusFilter ? 1 : 0)}
                </span>
              )}
            </button>
            {general.open && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => general.setOpen(false)} />
                <div
                  className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
                  style={{ top: general.pos.top, left: general.pos.left, width: general.pos.width }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                    <button onClick={() => general.setOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">All</option>
                        {METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => { setPaymentMethod(""); setDateRange({ start: "", end: "" }); setStatusFilter(""); setCurrentPage(1); }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Clear All
                    </button>
                    <button onClick={() => general.setOpen(false)} className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600">
                      Apply Filters
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 font-medium">Total Transaksi</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {(filteredSorted || []).length.toLocaleString("id-ID")}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 font-medium">Total Produk Terjual</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {((filteredSorted || []).reduce((sum, r) => {
              const items = Array.isArray(r.items) ? r.items : [];
              return sum + items.reduce((itemSum, item) => itemSum + toNumber(item.qty || item.quantity || 1), 0);
            }, 0)).toLocaleString("id-ID")}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="text-sm text-gray-600 font-medium">Total Pendapatan</div>
        <div className="text-2xl font-bold text-emerald-600 mt-1">
          {formatIDR(
            (filteredSorted || []).reduce((sum, r) => {
              const value =
                r.final_total === null || r.final_total === 0 || r.final_total === undefined
                  ? r.total ?? 0
                  : r.final_total;

              return sum + toNumber(value);
            }, 0)
          )}
        </div>
      </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        <div className="relative w-full overflow-x-auto">
          <div className="inline-block align-middle w-full">
            <DataTable
              columns={columns}
              data={pageRows}
              loading={loading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={(p) => setCurrentPage(p)}
              stickyHeader
              getRowKey={(row, i) => row.id ?? row.code ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (saleDetail || selectedSale) && (
        <SaleDetailModal
          open
          loading={detailLoading}
          onClose={() => { setShowDetail(false); setSelectedSale(null); setSaleDetail(null); }}
          sale={saleDetail || selectedSale}
        />
      )}

      {/* Reject / Void ConfirmDialog */}
      <ConfirmDialog
        open={rejectOpen}
        title="Void / Reject Transaksi"
        confirmText="Reject"
        loadingText="Rejecting..."
        cancelText="Batal"
        variant="danger"
        loading={rejectLoading}
        onClose={() => { if (!rejectLoading) setRejectOpen(false); }}
        onConfirm={confirmReject}
        message={
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Anda akan me-<b>void</b> transaksi{" "}
              <span className="font-semibold">{rejectRow?.code || rejectRow?.id}</span>. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alasan (opsional)</label>
              <textarea
                rows={3}
                placeholder="Tulis alasan pembatalan di sini…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={rejectLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
              {rejectError && (<div className="mt-2 text-xs text-red-600 whitespace-pre-line">{rejectError}</div>)}
            </div>
          </div>
        }
      />
    </>
  );
}
