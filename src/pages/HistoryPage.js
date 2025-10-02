// src/pages/HistoryPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "../components/data-table";
import { Calendar, Filter, X } from "lucide-react";
import toast from "react-hot-toast";
import { getSales, getSale } from "../api/sales";
import SaleDetailModal from "../components/sales/SaleDetailModal";

const PER_PAGE = 10;

const toNumber = (v) => (v == null ? 0 : Number(v));
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

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

// Normalisasi nama metode agar konsisten
const normalizeMethod = (m) => String(m || "").trim().toUpperCase();

export default function HistoryPage() {
  // data & meta
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: PER_PAGE,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  // query state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // filters
  const [showFilters, setShowFilters] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);

  // filter popover pos
  const btnRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // build params
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

  // fetch list
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getSales(params, controller.signal)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(
          meta || {
            current_page: 1,
            last_page: 1,
            per_page: PER_PAGE,
            total: items?.length || 0,
          }
        );
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

  // open detail (fetch detail untuk modal)
  const openDetail = useCallback(async (row) => {
    setSelectedSale(row);
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const id = row.id;
      const detail = await getSale(id);
      setSaleDetail(detail);
    } catch {
      toast.error("Gagal memuat detail transaksi");
      setShowDetail(false);
      setSelectedSale(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // columns
  const columns = useMemo(
    () => [
      {
        key: "code",
        label: "Transaction Number",
        sticky: "left",
        sortable: true,
        minWidth: "200px",
        className: "font-medium text-gray-900",
        render: (v, row) => v || row.number || row.transactionNumber || "-",
      },
      {
        key: "created_at",
        label: "Tanggal",
        sortable: true,
        minWidth: "170px",
        render: (v, row) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{formatDateTime(v || row.tanggal)}</span>
          </div>
        ),
      },
      {
        key: "customer_name",
        label: "Customer",
        sortable: true,
        minWidth: "140px",
        render: (v, row) => v || row.customer || "General",
      },
      {
        key: "subtotal",
        label: "Sub Total",
        align: "right",
        minWidth: "140px",
        className: "font-medium text-gray-900",
        sortable: true,
        render: (v, row) => formatIDR(v ?? row.subTotal),
      },
      {
        key: "paid",
        label: "Pay",
        align: "right",
        minWidth: "140px",
        className: "font-medium text-gray-900",
        sortable: true,
        render: (v, row) => {
          const paidFromPayments = Array.isArray(row.payments)
            ? row.payments.reduce((s, p) => s + toNumber(p.amount), 0)
            : null;
          return formatIDR(paidFromPayments ?? v ?? row.pay ?? row.paid_amount);
        },
      },
      {
        key: "change",
        label: "Change",
        align: "right",
        minWidth: "120px",
        render: (v, row) => formatIDR(v ?? row.change),
      },
      {
        key: "payment_method",
        label: "Payment Method",
        minWidth: "180px",
        render: (value, row) => {
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
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    styleMap[m] || "bg-gray-100 text-gray-800 border-gray-200"
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: "actions",
        label: "Action",
        sticky: "right",
        align: "center",
        minWidth: "160px",
        render: (value, row) => (
          <button
            onClick={() => openDetail(row)}
            className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Tampilkan Detail
          </button>
        ),
      },
    ],
    [openDetail]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DataTable
        data={rows}
        columns={columns}
        title="Transaction History"
        searchable={true}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          setCurrentPage(1);
        }}
        sortConfig={{ key: sortKey, direction: sortDir }}
        onSort={handleSort}
        currentPage={meta.current_page || 1}
        totalPages={meta.last_page || 1}
        onPageChange={setCurrentPage}
        startIndex={((meta.current_page || 1) - 1) * (meta.per_page || PER_PAGE)}
        endIndex={Math.min(
          (meta.current_page || 1) * (meta.per_page || PER_PAGE),
          meta.total || rows.length
        )}
        totalItems={meta.total ?? rows.length}
        filterComponent={
          <FilterComponent
            btnRef={btnRef}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            popoverPos={popoverPos}
            setPopoverPos={setPopoverPos}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            dateRange={dateRange}
            setDateRange={setDateRange}
            setCurrentPage={setCurrentPage}
          />
        }
        actions={null}
        loading={loading}
      />

      {/* DETAIL MODAL */}
      {showDetail && (
        <SaleDetailModal
          open={showDetail}
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

/* =================== Filter Component (LOCAL) =================== */
function FilterComponent({
  btnRef,
  showFilters,
  setShowFilters,
  popoverPos,
  setPopoverPos,
  paymentMethod,
  setPaymentMethod,
  dateRange,
  setDateRange,
  setCurrentPage,
}) {
  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        onClick={() => {
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
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Filter className="w-4 h-4" />
        Filter
        {(paymentMethod || dateRange.start || dateRange.end) && (
          <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
            {(paymentMethod ? 1 : 0) + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
          </span>
        )}
      </button>

      {showFilters && <div className="fixed inset-0 z-40" onMouseDown={() => setShowFilters(false)} />}

      {showFilters && (
        <div
          className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ top: popoverPos.top, left: popoverPos.left }}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-500 bg-white"
              >
                <option value="">All</option>
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="E-Wallet">E-Wallet</option>
                <option value="Card">Card</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
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
    </div>
  );
}