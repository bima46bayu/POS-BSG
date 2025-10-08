// src/pages/HistoryPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, X, Search, Filter, Download } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "../components/data-table/DataTable";
import { getSales, getSale } from "../api/sales";
import SaleDetailModal from "../components/sales/SaleDetailModal";

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

const normMethodKey = (m) => (m === "QRIS" ? "QRIS" : String(m || "").toLowerCase());
const isWithinDateRange = (iso, start, end) => {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

export default function HistoryPage() {
  const [rawRows, setRawRows] = useState([]);
  const [serverMeta, setServerMeta] = useState({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const [showFilters, setShowFilters] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);

  const btnRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const clientFilterActive = Boolean(paymentMethod || dateRange.start || dateRange.end);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = clientFilterActive
      ? { page: 1, per_page: 100000, code: searchTerm.trim() || undefined, sort: sortKey || undefined, dir: sortKey ? sortDir : undefined }
      : { page: currentPage, per_page: PER_PAGE, code: searchTerm.trim() || undefined, sort: sortKey || undefined, dir: sortKey ? sortDir : undefined };

    getSales(params, controller.signal)
      .then(({ items, meta }) => {
        setRawRows(items || []);
        setServerMeta(meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: (items || []).length });
      })
      .catch((err) => {
        const isCanceled = err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat history transaksi");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [searchTerm, sortKey, sortDir, currentPage, clientFilterActive, dateRange.start, dateRange.end, paymentMethod]);

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
      if (dateRange.start || dateRange.end) list = list.filter((r) => isWithinDateRange(r.created_at, dateRange.start, dateRange.end));
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        list = list.filter((r) => String(r.code || "").toLowerCase().includes(q));
      }
      if (sortKey) {
        const dir = sortDir === "desc" ? -1 : 1;
        list = [...list].sort((a, b) => {
          const va = a[sortKey]; const vb = b[sortKey];
          if (va == null && vb == null) return 0;
          if (va == null) return -1 * dir;
          if (vb == null) return 1 * dir;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }
    }
    return list;
  }, [rawRows, clientFilterActive, paymentMethod, dateRange.start, dateRange.end, searchTerm, sortKey, sortDir]);

  const { pageRows, meta } = useMemo(() => {
    if (!clientFilterActive) return { pageRows: rawRows, meta: serverMeta };
    const total = filteredSorted.length;
    const last_page = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(currentPage, last_page);
    const startIdx = (current - 1) * PER_PAGE;
    const endIdx = startIdx + PER_PAGE;
    return { pageRows: filteredSorted.slice(startIdx, endIdx), meta: { current_page: current, last_page, per_page: PER_PAGE, total } };
  }, [clientFilterActive, filteredSorted, rawRows, serverMeta, currentPage]);

  const handleSort = useCallback((key) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  }, [sortKey]);

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
      k === "QRIS" ? "QRIS" : k === "ewallet" ? "E-Wallet" : k === "transfer" ? "Bank Transfer" : k.charAt(0).toUpperCase() + k.slice(1);

    return (
      <div className="flex flex-wrap gap-1">
        {methods.map((m, i) => (
          <span
            key={`${m}-${i}`}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              styleMap[m] || styleMap["-"]
            }`}
          >
            {label(m)}
          </span>
        ))}
      </div>
    );
  };

  // === Responsive column cells (pakai truncate + max-w responsif) ===
  const CodeCell = ({ row }) => (
    <span
      className="block whitespace-nowrap truncate max-w-[9rem] sm:max-w-[12rem] lg:max-w-[16rem]"
      title={row.code || row.number || "-"}
    >
      {row.code || row.number || "-"}
    </span>
  );

  const DateCell = ({ row }) => (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="block truncate max-w-[8rem] sm:max-w-[10rem] lg:max-w-[12rem]" title={row.created_at}>
        {formatDateTime(row.created_at)}
      </span>
    </div>
  );

  const TextCell = ({ children, title }) => (
    <span className="block whitespace-nowrap truncate max-w-[8rem] sm:max-w-[10rem] lg:max-w-[12rem]" title={title}>
      {children}
    </span>
  );

  // ===== Columns (tanpa width fixed; biarkan fleksibel & responsif) =====
  const columns = [
    { key: "code", header: "Transaction", sticky: "left", cell: (row) => <CodeCell row={row} />, className: "font-medium" },

    { key: "created_at", header: "Tanggal", cell: (row) => <DateCell row={row} /> },

    { key: "customer_name", header: "Customer", cell: (row) => (
        <TextCell title={row.customer_name || "General"}>{row.customer_name || "General"}</TextCell>
      ) },

    { key: "subtotal", header: "Sub Total", align: "right", className: "hidden xs:table-cell", cell: (row) => (
        <TextCell title={String(formatIDR(row.subtotal))}>{formatIDR(row.subtotal)}</TextCell>
      ) },

    { key: "paid", header: "Pay", align: "right", className: "hidden sm:table-cell",
      accessor: (row) => (Array.isArray(row.payments) ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0) : row.paid),
      cell: (row) => {
        const val = Array.isArray(row.payments) ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0) : row.paid;
        return <TextCell title={String(formatIDR(val))}>{formatIDR(val)}</TextCell>;
      } },

    { key: "change", header: "Change", align: "right", className: "hidden md:table-cell", cell: (row) => (
        <TextCell title={String(formatIDR(row.change))}>{formatIDR(row.change)}</TextCell>
      ) },

    { key: "payment_method", header: "Payment", className: "hidden sm:table-cell", cell: (row) => <PaymentBadge row={row} /> },

    // Sticky-right Actions (freeze)
    {
      key: "__actions",
      header: () => (
        <div className="sticky right-0 z-30 bg-white text-right pr-3" style={{ boxShadow: "-6px 0 6px -6px rgba(0,0,0,.12)" }}>
          Actions
        </div>
      ),
      sticky: "right",
      className: "sticky right-0 z-20 bg-white",
      cell: (row) => (
        <div
          className="sticky right-0 z-20 bg-white flex justify-end pr-2"
          style={{ boxShadow: "-6px 0 6px -6px rgba(0,0,0,.12)" }}
        >
          <button
            onClick={() => openDetail(row)}
            className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
          >
            Detail
          </button>
        </div>
      ),
    },
  ];

  const toggleFilter = () => {
    if (!showFilters) {
      const el = btnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const gap = 8, width = 320;
        const left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
        const top = Math.min(r.bottom + gap, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  };

  const exportCSV = async () => {
    try {
      toast.loading("Menyiapkan CSV...", { id: "exp" });
      const data = clientFilterActive ? filteredSorted : rawRows;

      const headers = ["Transaction Number", "Tanggal", "Customer", "Sub Total", "Pay", "Change", "Payment Methods"];
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = (data || []).map((r) => {
        const pay = Array.isArray(r.payments) ? r.payments.reduce((s, p) => s + toNumber(p.amount), 0) : r.paid;
        const methods =
          Array.isArray(r.payments) && r.payments.length
            ? [...new Set(r.payments.map((p) => normMethodKey(p.method)))]
                .map((m) => (m === "QRIS" ? "QRIS" : m === "ewallet" ? "E-Wallet" : m === "transfer" ? "Bank Transfer" : m[0].toUpperCase() + m.slice(1)))
                .join(" | ")
            : (r.payment_method || r.method || "-");

        return [
          r.code || r.number || "-",
          formatDateTime(r.created_at),
          r.customer_name || "General",
          formatIDR(r.subtotal),
          formatIDR(pay),
          formatIDR(r.change),
          methods,
        ].map(escape).join(",");
      });

      const csv = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `history-transactions-${ts}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV berhasil diunduh", { id: "exp" });
    } catch {
      toast.error("Gagal mengekspor CSV", { id: "exp" });
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Transaction History</h2>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
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
          <div className="flex items-center gap-2">
            <button
              ref={btnRef}
              onClick={toggleFilter}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
              {(paymentMethod || dateRange.start || dateRange.end) && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {(paymentMethod ? 1 : 0) + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table (full width, responsif) */}
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

      {/* Overlay filter */}
      {showFilters && <div className="fixed inset-0 z-40" onMouseDown={() => setShowFilters(false)} />}

      {/* Filter Popover */}
      {showFilters && (
        <div
          className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ top: popoverPos.top, left: popoverPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {/* Payment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All</option>
                {METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => { setDateRange((p) => ({ ...p, start: e.target.value })); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => { setDateRange((p) => ({ ...p, end: e.target.value })); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => { setPaymentMethod(""); setDateRange({ start: "", end: "" }); setCurrentPage(1); }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (saleDetail || selectedSale) && (
        <SaleDetailModal
          open
          loading={detailLoading}
          onClose={() => {
            setShowDetail(false);
            setSelectedSale(null);
            setSaleDetail(null);
          }}
          sale={saleDetail || selectedSale}
        />
      )}
    </div>
  );
}
