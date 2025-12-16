// src/components/reports/HistoryByItem.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Calendar, Download, Package, MapPin, X, Filter as FilterIcon, Eye } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "../data-table/DataTable";
import { listSaleItems } from "../../api/reports";
import { getMe } from "../../api/users";
import { listStoreLocations } from "../../api/storeLocations";
import { getProducts } from "../../api/products";
import { getCategories, getSubCategories } from "../../api/categories";
import useAnchoredPopover from "../../lib/useAnchoredPopover";
import * as XLSX from "xlsx";
import HistoryItemDetailModal from "./HistoryItemDetailModal";

const PER_PAGE = 10;
const STORE_KEY = "history_store_id";

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "card", label: "Card" },
];

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
    .filter((s) => s && s.id != null && s.name)
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

  // category filters (real value)
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");

  // payment method filter (real value)
  const [paymentMethod, setPaymentMethod] = useState("");

  // draft filters (di dalam popover)
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftSubCategoryId, setDraftSubCategoryId] = useState("");
  const [draftPaymentMethod, setDraftPaymentMethod] = useState("");

  // category lists
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  // store (admin boleh "", kasir terkunci myStoreId)
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState([]);

  // data
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // products (untuk ambil category/subcategory dari API product)
  const [products, setProducts] = useState([]);

  // detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  // maps
  const productMap = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      if (p?.id != null) m[p.id] = p;
    });
    return m;
  }, [products]);

  const categoryNameMap = useMemo(() => {
    const m = {};
    (categories || []).forEach((c) => {
      if (c?.id != null) m[c.id] = c.name;
    });
    return m;
  }, [categories]);

  const subCategoryNameMap = useMemo(() => {
    const m = {};
    (subCategories || []).forEach((s) => {
      if (s?.id != null) m[s.id] = s.name;
    });
    return m;
  }, [subCategories]);

  // popover store
  const storeBtnRef = useRef(null);
  const store = useAnchoredPopover();
  useEffect(() => {
    store.setAnchor(storeBtnRef.current);
  }, [store]);

  // popover filter
  const filterBtnRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0, width: 320 });

  const openFilterPopover = () => {
    const el = filterBtnRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const width = 320;
      const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
      setFilterPos({ top, left, width });
    }
    setDraftCategoryId(categoryId);
    setDraftSubCategoryId(subCategoryId);
    setDraftPaymentMethod(paymentMethod);
    setShowFilters(true);
  };

  const applyFilters = () => {
    setCategoryId(draftCategoryId);
    setSubCategoryId(draftSubCategoryId);
    setPaymentMethod(draftPaymentMethod);
    setPage(1);
    setShowFilters(false);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (categoryId) n++; // category terpilih
    if (subCategoryId) n++; // subcategory terpilih
    if (paymentMethod) n++; // metode pembayaran terpilih
    return n;
  }, [categoryId, subCategoryId, paymentMethod]);

  const clearFilters = () => {
    setDraftCategoryId("");
    setDraftSubCategoryId("");
    setDraftPaymentMethod("");
    setCategoryId("");
    setSubCategoryId("");
    setPaymentMethod("");
    setPage(1);
  };

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

  // load categories + subcategories LIST (buat pilihan filter)
  useEffect(() => {
    (async () => {
      try {
        const catRes = await getCategories().catch(() => null);
        let cats = [];
        const payload = catRes?.data ?? catRes;
        if (Array.isArray(payload)) cats = payload;
        else if (Array.isArray(payload?.data)) cats = payload.data;
        setCategories(cats || []);

        // coba ambil sub dari nested categories dulu
        let subs = [];
        (cats || []).forEach((c) => {
          const children = c.sub_categories || c.subCategories || c.children || c.subs || [];
          (children || []).forEach((sc) => {
            subs.push({
              id: sc.id,
              name: sc.name,
              category_id: sc.category_id ?? sc.categoryId ?? c.id,
            });
          });
        });

        // kalau tidak ada di nested, fallback ke endpoint sub-categories
        if (!subs.length) {
          const subRes = await getSubCategories().catch(() => null);
          const subPayload = subRes?.data ?? subRes;
          const rawSubs = Array.isArray(subPayload)
            ? subPayload
            : Array.isArray(subPayload?.data)
            ? subPayload.data
            : [];
          subs = rawSubs.map((s) => ({
            id: s.id,
            name: s.name,
            category_id: s.category_id ?? s.categoryId ?? s.parent_id ?? s.parentId ?? null,
          }));
        }

        setSubCategories(subs || []);
      } catch {
        // kalau gagal, tanpa filter kategori
      }
    })();
  }, []);

  // load products (supaya kita bisa baca category/subcategory by product_id)
  useEffect(() => {
    (async () => {
      try {
        const chosenStore = isAdmin ? storeId : myStoreId ? String(myStoreId) : "";
        const params = {
          per_page: 1000,
          ...(chosenStore ? { store_location_id: chosenStore, only_store: 1 } : {}),
        };
        const { items } = await getProducts(params);
        setProducts(items || []);
      } catch {
        // kalau gagal, category/subcategory di table jadi "-"
      }
    })();
  }, [isAdmin, storeId, myStoreId]);

  const fetchList = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);

    // Admin: "" = All (pakai { all:1 } agar backend ambil semua), ada nilai → { store_id }
    // Kasir: { store_id: myStoreId }
    const chosenStore = isAdmin ? storeId : myStoreId ? String(myStoreId) : "";
    const params = {
      page,
      per_page: PER_PAGE,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: q || undefined,
      payment_method: paymentMethod || undefined,
      ...(isAdmin
        ? chosenStore
          ? { store_id: chosenStore }
          : { all: 1 }
        : myStoreId
        ? { store_id: String(myStoreId) }
        : {}),
      // filter category/subcategory sengaja TIDAK dikirim ke BE, kita filter di FE
    };

    listSaleItems(params, controller.signal)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(
          meta || {
            current_page: page,
            last_page: 1,
            per_page: PER_PAGE,
            total: (items || []).length,
          }
        );
      })
      .catch((err) => {
        const isCanceled = err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat data by item");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, dateFrom, dateTo, q, storeId, isAdmin, myStoreId, paymentMethod]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // apply filter category/subcategory di FE
  const filteredRows = useMemo(() => {
    let arr = rows || [];
    if (categoryId) {
      arr = arr.filter((r) => {
        const p = productMap[r.product_id];
        if (!p?.category_id) return false;
        return String(p.category_id) === String(categoryId);
      });
    }
    if (subCategoryId) {
      arr = arr.filter((r) => {
        const p = productMap[r.product_id];
        if (!p?.sub_category_id) return false;
        return String(p.sub_category_id) === String(subCategoryId);
      });
    }
    return arr;
  }, [rows, categoryId, subCategoryId, productMap]);

  const filteredSubCategories = useMemo(() => {
    if (!draftCategoryId) return subCategories;
    return subCategories.filter((s) => String(s.category_id) === String(draftCategoryId));
  }, [subCategories, draftCategoryId]);

  const handleOpenDetail = (row) => {
    setDetailRow(row);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailRow(null);
  };

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
      {
        key: "category",
        header: "Category",
        className: "hidden sm:table-cell min-w-[200px]",
        cell: (r) => {
          const p = productMap[r.product_id];
          const catName = p?.category_id ? categoryNameMap[p.category_id] : "-";
          const subName = p?.sub_category_id ? subCategoryNameMap[p.sub_category_id] : "";
          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-900">{catName || "-"}</span>
              <span className="text-xs text-gray-500">{subName || ""}</span>
            </div>
          );
        },
      },
      {
        key: "qty",
        header: "Qty",
        align: "right",
        cell: (r) => <span className="tabular-nums">{toNumber(r.qty)}</span>,
      },
      {
        key: "transaction_count",
        header: "# Transaction",
        align: "right",
        className: "hidden sm:table-cell",
        // pastikan BE mengirim field `transaction_count`
        cell: (r) => <span className="tabular-nums">{toNumber(r.transaction_count)}</span>,
      },
      {
        key: "gross",
        header: "Gross Sales",
        align: "right",
        cell: (r) => <span className="tabular-nums">{formatIDR(r.gross)}</span>,
      },
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
      {
        key: "actions",
        header: "Action",
        align: "right",
        className: "w-px",
        cell: (r) => (
          <button
            type="button"
            onClick={() => handleOpenDetail(r)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            <Eye className="w-3 h-3" />
            Detail
          </button>
        ),
      },
    ],
    [productMap, categoryNameMap, subCategoryNameMap]
  );

  const exportExcel = () => {
    try {
      toast.loading("Menyiapkan Excel…", { id: "exp-xlsx" });

      const header = [
        "SKU",
        "Product",
        "Category",
        "Subcategory",
        "Qty",
        "# Transaction",
        "Gross Sales (IDR)",
        "Avg Price (IDR)",
        "Last Sold At",
        "Store",
        "Payment Method Filter",
      ];
      const chosenStore = isAdmin ? storeId : myStoreId ? String(myStoreId) : "";
      const storeName = chosenStore
        ? stores.find((s) => s.id === chosenStore)?.name || chosenStore
        : "All Stores";

      const paymentLabel =
        PAYMENT_METHOD_OPTIONS.find((opt) => opt.value === paymentMethod)?.label || "All Methods";

      const rowsX = filteredRows.map((r) => {
        const qty = toNumber(r.qty) || 1;
        const avg = Math.round(toNumber(r.gross) / qty);
        const p = productMap[r.product_id];
        const catName = p?.category_id ? categoryNameMap[p.category_id] : "-";
        const subName = p?.sub_category_id ? subCategoryNameMap[p.sub_category_id] : "";
        return [
          r.sku || "-",
          r.product_name || "-",
          catName || "-",
          subName || "",
          toNumber(r.qty),
          toNumber(r.transaction_count),
          toNumber(r.gross),
          avg,
          r.last_sold_at ? new Date(r.last_sold_at).toLocaleString("id-ID") : "-",
          storeName,
          paymentLabel,
        ];
      });

      const aoa = [header, ...rowsX];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const colWidths = header.map((h, i) => {
        const maxLen = Math.max(String(h).length, ...rowsX.map((row) => String(row[i] ?? "").length));
        return { wch: Math.min(Math.max(10, maxLen + 2), 40) };
      });
      ws["!cols"] = colWidths;

      const note = `${dateFrom || "all"}_to_${dateTo || "all"}_${
        chosenStore ? `store_${chosenStore}` : "all-stores"
      }_${paymentMethod || "all-methods"}`.replace(/[:\/\\]/g, "-");
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
                  <div className="p-3 max-h-[300px] overflow-auto">
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
                          storeId === String(s.id)
                            ? "bg-blue-50 border-blue-200"
                            : "border-transparent hover:bg-gray-50"
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

          {/* Filter button (Category, Subcategory, Payment Method) */}
          <button
            ref={filterBtnRef}
            onClick={openFilterPopover}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
          >
            <FilterIcon className="w-4 h-4" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

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

      {/* Filter Popover */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
            style={{ top: filterPos.top, left: filterPos.left, width: filterPos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">Filter</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={draftCategoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftCategoryId(val);
                    // reset subcategory yang tidak cocok
                    setDraftSubCategoryId((prev) => {
                      if (!prev) return "";
                      const ok = subCategories.some(
                        (s) => String(s.id) === String(prev) && String(s.category_id) === String(val)
                      );
                      return ok ? prev : "";
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subcategory</label>
                <select
                  value={draftSubCategoryId}
                  onChange={(e) => setDraftSubCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Subcategory</option>
                  {filteredSubCategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={draftPaymentMethod}
                  onChange={(e) => setDraftPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-between items-center">
              <button onClick={clearFilters} className="text-sm text-gray-600">
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        <div className="relative w-full overflow-x-auto">
          <div className="inline-block align-middle w-full">
            <DataTable
              columns={columns}
              data={filteredRows}
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

      {/* Detail Modal */}
      <HistoryItemDetailModal
        open={detailOpen}
        onClose={handleCloseDetail}
        row={detailRow}
        filters={{
          dateFrom,
          dateTo,
          paymentMethod,
          isAdmin,
          storeId,
          myStoreId,
        }}
      />
    </>
  );
}
