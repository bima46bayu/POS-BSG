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

const normalizeMethod = (m) => String(m || "").trim().toUpperCase();

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
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

  const params = useMemo(() => {
    const p = { page: currentPage, per_page: PER_PAGE };
    if (searchTerm.trim()) p.search = searchTerm.trim();
    if (paymentMethod) p.payment_method = paymentMethod;
    if (dateRange.start) p.date_from = dateRange.start;
    if (dateRange.end) p.date_to = dateRange.end;
    if (sortKey) {
      p.sort = sortKey;
      p.dir = sortDir;
    }
    return p;
  }, [currentPage, searchTerm, paymentMethod, dateRange.start, dateRange.end, sortKey, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getSales(params, controller.signal)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
      })
      .catch((err) => {
        const isCanceled = err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat history transaksi");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [params]);

  const handleSort = useCallback(
    (key) => {
      if (!key) return;
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
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

  const getPaymentMethodBadge = (value, row) => {
    const methodsFromPayments =
      Array.isArray(row.payments) && row.payments.length
        ? [...new Set(row.payments.map((p) => normalizeMethod(p.method)))]
        : null;

    const single = value || row.payment_method || row.method || "-";
    const methods = methodsFromPayments || [normalizeMethod(single)];

    const styleMap = {
      CASH: "bg-green-100 text-green-800 border-green-200",
      QRIS: "bg-orange-100 text-orange-800 border-orange-200",
      "E-WALLET": "bg-purple-100 text-purple-800 border-purple-200",
      EWALLET: "bg-purple-100 text-purple-800 border-purple-200",
      CARD: "bg-blue-100 text-blue-800 border-blue-200",
      TRANSFER: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };

    return (
      <div className="flex flex-wrap gap-1">
        {methods.map((m, i) => (
          <span
            key={`${m}-${i}`}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              styleMap[m] || "bg-gray-100 text-gray-800 border-gray-200"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    );
  };

  // ===== Kolom DataTable =====
  const columns = [
    {
      key: "code",
      header: "Transaction Number",
      sticky: "left",
      width: "180px",
      cell: (row) => row.code || row.number || "-",
      className: "font-medium",
    },
    {
      key: "created_at",
      header: "Tanggal",
      width: "160px",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{formatDateTime(row.created_at)}</span>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "Customer",
      width: "140px",
      cell: (row) => row.customer_name || "General",
    },
    {
      key: "subtotal",
      header: "Sub Total",
      align: "right",
      width: "120px",
      cell: (row) => formatIDR(row.subtotal),
    },
    {
      key: "paid",
      header: "Pay",
      align: "right",
      width: "120px",
      accessor: (row) =>
        Array.isArray(row.payments) ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0) : row.paid,
      cell: (row) =>
        formatIDR(Array.isArray(row.payments) ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0) : row.paid),
    },
    {
      key: "change",
      header: "Change",
      align: "right",
      width: "110px",
      cell: (row) => formatIDR(row.change),
    },
    {
      key: "payment_method",
      header: "Payment",
      width: "150px",
      cell: (row) => getPaymentMethodBadge(row.payment_method, row),
    },
  ];

  // ===== Filter popover positioning =====
  const toggleFilter = () => {
    if (!showFilters) {
      const el = btnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const gap = 8;
        const width = 320;
        const left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
        const top = Math.min(r.bottom + gap, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  };

  // ===== Export CSV =====
  const exportCSV = async () => {
    try {
      toast.loading("Menyiapkan CSV...", { id: "exp" });

      // Ambil semua data sesuai filter (bukan hanya page saat ini).
      const p = { ...params, page: 1, per_page: meta?.total || 100000 };
      const { items } = await getSales(p);

      const headers = [
        "Transaction Number",
        "Tanggal",
        "Customer",
        "Sub Total",
        "Pay",
        "Change",
        "Payment Methods",
      ];

      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const rowsCsv = (items || []).map((r) => {
        const pay = Array.isArray(r.payments)
          ? r.payments.reduce((s, p) => s + toNumber(p.amount), 0)
          : r.paid;

        const methods =
          Array.isArray(r.payments) && r.payments.length
            ? [...new Set(r.payments.map((p) => normalizeMethod(p.method)))].join(" | ")
            : normalizeMethod(r.payment_method || r.method || "-");

        return [
          r.code || r.number || "-",
          formatDateTime(r.created_at),
          r.customer_name || "General",
          formatIDR(r.subtotal),
          formatIDR(pay),
          formatIDR(r.change),
          methods,
        ]
          .map(escape)
          .join(",");
      });

      const csv = [headers.join(","), ...rowsCsv].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `history-transactions-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("CSV berhasil diunduh", { id: "exp" });
    } catch (e) {
      toast.error("Gagal mengekspor CSV", { id: "exp" });
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* ====== SECTION 1: Title saja (terpisah) ====== */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Transaction History</h2>
      </div>

      {/* ====== SECTION 2: Controls (Search + Filter + Export) sejajar ====== */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search (flex-1 agar tombol sejajar, ikut baseline) */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Tombol di kanan, tetapi satu baris dengan search */}
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

      {/* ====== SECTION 3: Table dengan scroll horizontal ====== */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              meta={meta}
              currentPage={currentPage}
              onPageChange={(p) => setCurrentPage(p)}
              stickyHeader
              // fokus horizontal scroll → tidak set maxHeight
              renderActions={(row) => (
                <button
                  onClick={() => openDetail(row)}
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Detail
                </button>
              )}
              getRowKey={(row, i) => row.id ?? row.code ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Overlay untuk menutup popover */}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All</option>
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Card">Card</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => {
                    setDateRange((p) => ({ ...p, start: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => {
                    setDateRange((p) => ({ ...p, end: e.target.value }));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                setPaymentMethod("");
                setDateRange({ start: "", end: "" });
                setCurrentPage(1);
              }}
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
      {showDetail && (
        <SaleDetailModal
          open={showDetail}
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
