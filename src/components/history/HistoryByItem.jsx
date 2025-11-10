import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Calendar, Download, Package, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "../data-table/DataTable";
import { listSaleItems } from "../../api/reports";
import { getMe } from "../../api/users";
import { listStoreLocations } from "../../api/storeLocations";
import useAnchoredPopover from "../../lib/useAnchoredPopover";
import * as XLSX from "xlsx";

const PER_PAGE = 10;
const STORE_KEY = "history_store_id";

const toNumber = (v) => (v == null ? 0 : Number(v));
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function defaultStoreFromMe(me) {
  const id = me?.store_location_id ?? me?.store_location?.id;
  return id ? String(id) : "";
}
function normalizeStores(arr = []) {
  return (arr || [])
    .filter((s) => s && (s.id != null) && s.name)
    .map((s) => ({ id: String(s.id), name: s.name }));
}

export default function HistoryByItem() {
  // me & role
  const [me, setMe] = useState(null);
  const isAdmin = useMemo(() => String(me?.role || "").toLowerCase() === "admin", [me]);
  const myStoreId = useMemo(() => defaultStoreFromMe(me), [me]);

  // filters
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());

  // store (admin boleh "", kasir terkunci myStoreId)
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState([]);

  // data
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // popover
  const storeBtnRef = useRef(null);
  const store = useAnchoredPopover();
  useEffect(() => {
    store.setAnchor(storeBtnRef.current);
  }, [store]);

  // load me & stores (default dari getMe)
  useEffect(() => {
    (async () => {
      try {
        const meRes = await getMe().catch(() => null);
        setMe(meRes);

        const def = defaultStoreFromMe(meRes);
        setStoreId(def);
        if (def) localStorage.setItem(STORE_KEY, def);

        const { items: storesApi = [] } = await listStoreLocations({ per_page: 200 }).catch(() => ({}));
        const normalized = normalizeStores(storesApi);

        if (String(meRes?.role || "").toLowerCase() === "admin") {
          setStores(normalized);
        } else {
          const mid = def;
          const mname = meRes?.store_location?.name || "My Store";
          setStores(mid ? [{ id: mid, name: mname }] : []);
          if (mid) {
            setStoreId(mid);
            localStorage.setItem(STORE_KEY, mid);
          }
        }
      } catch {
        // noop
      }
    })();
  }, []);

  const fetchList = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);

    // Admin: "" = All (pakai { all:1 } agar backend ambil semua), ada nilai → { store_id }
    // Kasir: { store_id: myStoreId }
    const chosenStore = isAdmin ? storeId : (myStoreId ? String(myStoreId) : "");
    const params = {
      page,
      per_page: PER_PAGE,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: q || undefined,
      ...(isAdmin ? (chosenStore ? { store_id: chosenStore } : { all: 1 }) : (myStoreId ? { store_id: String(myStoreId) } : {})),
    };

    listSaleItems(params, controller.signal)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(meta || { current_page: page, last_page: 1, per_page: PER_PAGE, total: (items || []).length });
      })
      .catch((err) => {
        const isCanceled = err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat data by item");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, dateFrom, dateTo, q, storeId, isAdmin, myStoreId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const columns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        sticky: "left",
        className: "min-w-[220px]",
        cell: (r) => (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center border">
              <Package className="w-5 h-5 text-gray-500" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate" title={r.product_name}>
                {r.product_name || "-"}
              </div>
              <div className="text-xs text-gray-500 truncate" title={r.sku}>
                {r.sku || "-"}
              </div>
            </div>
          </div>
        ),
      },
      { key: "qty", header: "Qty", align: "right", cell: (r) => <span className="tabular-nums">{toNumber(r.qty)}</span> },
      { key: "gross", header: "Gross Sales", align: "right", cell: (r) => <span className="tabular-nums">{formatIDR(r.gross)}</span> },
      {
        key: "avg_price",
        header: "Avg Price",
        align: "right",
        className: "hidden sm:table-cell",
        cell: (r) => {
          const qty = toNumber(r.qty) || 1;
          const avg = Math.round(toNumber(r.gross) / qty);
          return <span className="tabular-nums">{formatIDR(avg)}</span>;
        },
      },
      {
        key: "last_sold_at",
        header: "Last Sold",
        className: "hidden md:table-cell",
        cell: (r) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate" title={r.last_sold_at || "-"}>
              {r.last_sold_at ? new Date(r.last_sold_at).toLocaleString("id-ID") : "-"}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const exportExcel = () => {
    try {
      toast.loading("Menyiapkan Excel…", { id: "exp-xlsx" });

      const header = ["SKU", "Product", "Qty", "Gross Sales (IDR)", "Avg Price (IDR)", "Last Sold At", "Store"];
      const chosenStore = isAdmin ? storeId : (myStoreId ? String(myStoreId) : "");
      const storeName = chosenStore
        ? stores.find((s) => s.id === chosenStore)?.name || chosenStore
        : "All Stores";

      const rowsX = rows.map((r) => {
        const qty = toNumber(r.qty) || 1;
        const avg = Math.round(toNumber(r.gross) / qty);
        return [
          r.sku || "-",
          r.product_name || "-",
          toNumber(r.qty),
          toNumber(r.gross),
          avg,
          r.last_sold_at ? new Date(r.last_sold_at).toLocaleString("id-ID") : "-",
          storeName,
        ];
      });

      const aoa = [header, ...rowsX];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const colWidths = header.map((h, i) => {
        const maxLen = Math.max(String(h).length, ...rowsX.map((row) => String(row[i] ?? "").length));
        return { wch: Math.min(Math.max(10, maxLen + 2), 40) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SalesByItem");

      const note = `${dateFrom || "all"}_to_${dateTo || "all"}_${chosenStore ? `store_${chosenStore}` : "all-stores"}`.replace(
        /[:\/\\]/g,
        "-"
      );
      XLSX.writeFile(wb, `history-by-item_${note}.xlsx`);
      toast.success("Excel berhasil diunduh", { id: "exp-xlsx" });
    } catch {
      toast.error("Gagal membuat Excel", { id: "exp-xlsx" });
    }
  };

  const onChangeStore = (val) => {
    if (!isAdmin) return; // kasir terkunci
    setStoreId(val); // "" = All Stores
    localStorage.setItem(STORE_KEY, val);
    setPage(1);
  };

  const chosenStoreLabel = useMemo(() => {
    if (!isAdmin) {
      return me?.store_location?.name || "My Store";
    }
    if (!storeId) return "All Stores";
    return stores.find((s) => s.id === storeId)?.name || "Selected Store";
  }, [isAdmin, storeId, stores, me]);

  return (
    <>
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari product / SKU..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* store popover */}
          <div className="relative">
            <button
              ref={storeBtnRef}
              onClick={() => isAdmin && store.setOpen(!store.open)}
              disabled={!isAdmin}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border ${
                isAdmin
                  ? "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                  : "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
              }`}
            >
              <MapPin className="w-4 h-4" />
              {chosenStoreLabel}
            </button>
            {isAdmin && store.open && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => store.setOpen(false)} />
                <div
                  className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
                  style={{ top: store.pos.top, left: store.pos.left, width: store.pos.width }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Store</h3>
                    <button onClick={() => store.setOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-3 max-h={[300]} overflow-auto">
                    <div className="mb-2">
                      <button
                        className={`w-full text-left px-3 py-2 rounded-md border ${
                          !storeId ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          onChangeStore("");
                          store.setOpen(false);
                        }}
                      >
                        All Stores
                      </button>
                    </div>
                    {stores.map((s) => (
                      <button
                        key={`${s.id}-${s.name}`}
                        className={`w-full text-left px-3 py-2 rounded-md border ${
                          storeId === String(s.id) ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          onChangeStore(String(s.id));
                          store.setOpen(false);
                        }}
                        title={s.name}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* date range */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* export */}
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        <div className="relative w-full overflow-x-auto">
          <div className="inline-block align-middle w-full">
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={(p) => setPage(p)}
              stickyHeader
              getRowKey={(row, i) => row.product_id ?? row.sku ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>
    </>
  );
}
