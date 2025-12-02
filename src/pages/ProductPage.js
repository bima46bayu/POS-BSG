// src/pages/ProductPage.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useTransition,
} from "react";
import {
  Calendar,
  Download,
  Filter,
  X,
  Edit,
  Trash2,
  Plus,
  Search,
  Store as StoreIcon,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";

import { toAbsoluteUrl } from "../api/client";
import {
  getProducts,
  deleteProduct,
  createProduct,
  updateProductWithImages,
  downloadProductImportTemplate,
} from "../api/products";
import { getCategories, getSubCategories } from "../api/categories";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";

import AddProduct from "../components/products/AddProduct";
import UpdateProduct from "../components/products/UpdateProduct";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DataTable from "../components/data-table/DataTable";
import ImportExcelModal from "../components/products/ImportExcelModal";

const PER_PAGE = 10;

/* ========= kecil2: cache kategori ========= */
const CACHE_KEY = "POS_CATEGORIES_CACHE_V1";
const CACHE_DIRTY_KEY = "POS_CATS_DIRTY";
const CAT_CACHE_TTL_MS = 5 * 60 * 1000;
const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeCache = (payload) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...payload, ts: Date.now() })
    );
  } catch {}
};
const isCacheStale = (ts) => !ts || Date.now() - ts > CAT_CACHE_TTL_MS;
const isDirty = () => localStorage.getItem(CACHE_DIRTY_KEY) === "1";
const clearDirty = () => localStorage.removeItem(CACHE_DIRTY_KEY);

/* ========= LRU cache untuk list products ========= */
const LIST_CACHE_TTL_MS = 60 * 1000;
const LIST_CACHE_MAX = 50;
const listCache = new Map();
const listCacheGet = (key) => {
  const hit = listCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > LIST_CACHE_TTL_MS) {
    listCache.delete(key);
    return null;
  }
  // refresh order
  listCache.delete(key);
  listCache.set(key, hit);
  return hit.payload;
};
const listCacheSet = (key, payload) => {
  if (listCache.has(key)) listCache.delete(key);
  listCache.set(key, { ts: Date.now(), payload });
  while (listCache.size > LIST_CACHE_MAX) {
    const first = listCache.keys().next().value;
    listCache.delete(first);
  }
};

/* ========= util kecil ========= */
const badgeClass = (n) => {
  const v = Number(n || 0);
  if (v === 0) return "bg-red-100 text-red-800";
  if (v <= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-blue-100 text-blue-800";
};
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
const formatDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", {
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
const normalizeSubCategories = (cats = []) => {
  const out = [];
  cats.forEach((c) => {
    const children =
      c.sub_categories || c.subCategories || c.children || c.subs || [];
    children.forEach((sc) => {
      out.push({
        id: sc.id,
        name: sc.name,
        category_id: sc.category_id ?? sc.categoryId ?? c.id,
      });
    });
  });
  return out;
};

// Serialize params ke key yang stabil
const stableKey = (obj) => {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((a, k) => ((a[k] = obj[k]), a), {});
  return JSON.stringify(sorted);
};

/* ========= debounce hook ========= */
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function ProductPage() {
  const [, startTransition] = useTransition();

  /* ====== User store dari /api/me ====== */
  const [myStoreId, setMyStoreId] = useState(undefined);
  const [storeName, setStoreName] = useState("-");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        const sid = me?.store_location?.id ?? me?.store_location_id ?? null;
        if (!cancelled) {
          setMyStoreId(sid);
          setStoreName(me?.store_location?.name ?? "-");
        }
      } catch {
        if (!cancelled) {
          setMyStoreId(null);
          setStoreName("-");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ====== daftar store untuk dropdown ====== */
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  useEffect(() => {
    let cancel = false;
    setStoresLoading(true);
    listStoreLocations({ per_page: 100 })
      .then(({ items }) => {
        if (cancel) return;
        setStores(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancel) toast.error("Gagal memuat daftar cabang");
      })
      .finally(() => {
        if (!cancel) setStoresLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  // store terpilih
  const [selectedStore, setSelectedStore] = useState("ALL");

  useEffect(() => {
    if (myStoreId !== undefined) {
      setSelectedStore((prev) =>
        prev === "ALL" || prev == null ? myStoreId ?? "ALL" : prev
      );
    }
  }, [myStoreId]);

  /* ====== filters ====== */
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  const [showFilters, setShowFilters] = useState(false);
  const btnRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // draft dalam popover
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftSubCategoryId, setDraftSubCategoryId] = useState("");
  const [draftStockStatus, setDraftStockStatus] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState({
    min: "",
    max: "",
  });

  /* ====== data ====== */
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  /* ====== modal & aksi ====== */
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Import Excel modal
  const [showImport, setShowImport] = useState(false);

  /* ====== kategori (cache) ====== */
  useEffect(() => {
    let cancel = false;

    const toArray = (res) => {
      const payload = res?.data ?? res;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const useCacheFirst = () => {
      const cached = readCache();
      if (cached?.categories?.length) {
        setCategories(cached.categories);
        setSubCategories(cached.subCategories || []);
      }
      return cached;
    };

    const fetchFresh = async () => {
      try {
        const catRes = await getCategories();
        if (cancel) return;
        const catList = toArray(catRes);
        let subs = normalizeSubCategories(catList);

        if (!subs.length) {
          try {
            const subRes = await getSubCategories();
            if (!cancel) {
              const rawSubs = toArray(subRes);
              subs = rawSubs.map((s) => ({
                id: s.id,
                name: s.name,
                category_id:
                  s.category_id ??
                  s.categoryId ??
                  s.parent_id ??
                  s.parentId ??
                  null,
              }));
            }
          } catch {}
        }

        if (cancel) return;
        setCategories(catList);
        setSubCategories(subs);
        writeCache({ categories: catList, subCategories: subs });
        clearDirty();
      } catch {
        if (!cancel) toast.error("Gagal memuat kategori");
      }
    };

    const cached = useCacheFirst();
    if (!cached || isCacheStale(cached.ts) || isDirty()) fetchFresh();

    const onStorage = (e) => {
      if (e.key === CACHE_DIRTY_KEY && e.newValue === "1") fetchFresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancel = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /* ====== query builder ====== */
  const queryParams = useMemo(() => {
    const p = { page: currentPage, per_page: PER_PAGE };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (categoryId) p.category_id = categoryId;
    if (subCategoryId) p.sub_category_id = subCategoryId;
    if (priceRange.min) p.min_price = priceRange.min;
    if (priceRange.max) p.max_price = priceRange.max;

    if (
      selectedStore !== "ALL" &&
      selectedStore != null &&
      selectedStore !== ""
    ) {
      p.store_id = selectedStore;
      p.only_store = 1;
    }
    return p;
  }, [
    currentPage,
    debouncedSearch,
    categoryId,
    subCategoryId,
    priceRange.min,
    priceRange.max,
    selectedStore,
  ]);

  const queryKey = useMemo(() => stableKey(queryParams), [queryParams]);

  /* ====== fetch ====== */
  const abortRef = useRef(null);

  const fetchList = useCallback(
    async (params, { useCache = true, signal } = {}) => {
      const k = stableKey(params);
      if (useCache) {
        const hit = listCacheGet(k);
        if (hit) return hit;
      }
      const res = await getProducts(params, signal);
      const payload = {
        items: res?.items || res?.data?.items || res?.data || [],
        meta:
          res?.meta ||
          res?.data?.meta || {
            current_page: 1,
            per_page: PER_PAGE,
            last_page: 1,
            total: 0,
          },
      };
      listCacheSet(k, payload);
      return payload;
    },
    []
  );

  const refetch = useCallback(async () => {
    if (myStoreId === undefined) return;

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const cacheHit = listCacheGet(queryKey);
    if (cacheHit) {
      startTransition(() => {
        setRows(cacheHit.items || []);
        setMeta(
          cacheHit.meta || {
            current_page: 1,
            per_page: PER_PAGE,
            total: 0,
            last_page: 1,
          }
        );
      });
    } else {
      setLoading(true);
    }

    try {
      const { items, meta } = await fetchList(queryParams, {
        useCache: true,
        signal: controller.signal,
      });
      startTransition(() => {
        setRows(items || []);
        setMeta(
          meta || {
            current_page: 1,
            per_page: PER_PAGE,
            total: 0,
            last_page: 1,
          }
        );
      });

      if ((meta?.current_page ?? 1) < (meta?.last_page ?? 1)) {
        const nextParams = {
          ...queryParams,
          page: (meta.current_page ?? 1) + 1,
        };
        fetchList(nextParams, { useCache: true }).catch(() => {});
      }
    } catch (err) {
      if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
        toast.error("Gagal memuat produk");
      }
    } finally {
      if (!cacheHit) setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [fetchList, myStoreId, queryKey, queryParams, startTransition]);

  useEffect(() => {
    if (myStoreId !== undefined && selectedStore !== undefined) refetch();
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [refetch, myStoreId, selectedStore]);

  /* ====== filter stok FE ====== */
  const filteredRows = useMemo(() => {
    let arr = rows;
    if (stockStatus) {
      const thr = (n) => Number(n ?? 0);
      if (stockStatus === "out") arr = arr.filter((p) => thr(p.stock) === 0);
      if (stockStatus === "low")
        arr = arr.filter((p) => thr(p.stock) > 0 && thr(p.stock) <= 5);
      if (stockStatus === "in") arr = arr.filter((p) => thr(p.stock) > 5);
    }
    return arr;
  }, [rows, stockStatus]);

  /* ====== UI helpers ====== */
  const toggleFilters = useCallback(() => {
    if (!showFilters) {
      setDraftCategoryId(categoryId);
      setDraftSubCategoryId(subCategoryId);
      setDraftStockStatus(stockStatus);
      setDraftPriceRange(priceRange);

      const el = btnRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const width = 384;
        const left = Math.min(
          Math.max(rect.right - width, 8),
          window.innerWidth - width - 8
        );
        const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  }, [showFilters, categoryId, subCategoryId, stockStatus, priceRange]);

  const applyFilters = useCallback(() => {
    setCategoryId(draftCategoryId);
    setSubCategoryId(draftSubCategoryId);
    setStockStatus(draftStockStatus);
    setPriceRange(draftPriceRange);
    setCurrentPage(1);
    setShowFilters(false);
  }, [
    draftCategoryId,
    draftSubCategoryId,
    draftStockStatus,
    draftPriceRange,
  ]);

  const clearAllFilters = useCallback(() => {
    setDraftCategoryId("");
    setDraftSubCategoryId("");
    setDraftStockStatus("");
    setDraftPriceRange({ min: "", max: "" });

    setCategoryId("");
    setSubCategoryId("");
    setStockStatus("");
    setPriceRange({ min: "", max: "" });
    setCurrentPage(1);
  }, []);

  /* ====== CRUD handlers ====== */
  const handleEdit = useCallback((row) => {
    setSelectedProduct(row);
    setShowEdit(true);
  }, []);
  const onDelete = useCallback((row) => {
    setConfirmTarget(row);
    setConfirmOpen(true);
  }, []);
  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmTarget.id);
      toast.success("Product deleted");
      listCache.clear();
      if (filteredRows.length === 1 && (meta.current_page || 1) > 1)
        setCurrentPage((p) => p - 1);
      else refetch();
    } catch {
      toast.error("Gagal menghapus produk");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  }, [confirmTarget, filteredRows.length, meta.current_page, refetch]);

  const handleCreate = useCallback(
    async (payload) => {
      try {
        if (myStoreId == null) {
          toast.error("Akun ini belum memiliki store. Hubungi admin.");
          return;
        }

        const body = { ...payload, store_location_id: myStoreId };

        // Antisipasi kalau AddProduct kirim images[] atau image tunggal:
        if (!body.image && Array.isArray(body.images) && body.images[0]) {
          body.image = body.images[0];
        }

        await createProduct(body);

        toast.success("Produk berhasil dibuat");
        setShowAdd(false);
        setCurrentPage(1);
        localStorage.setItem(CACHE_DIRTY_KEY, "1");
        listCache.clear();
        refetch();
      } catch (err) {
        console.error(err?.response?.data || err);
        toast.error(err?.response?.data?.message || "Gagal membuat produk");
      }
    },
    [myStoreId, refetch]
  );

  const handleUpdate = useCallback(
    async (payload) => {
      try {
        if (myStoreId == null) {
          toast.error("Akun ini belum memiliki store. Hubungi admin.");
          return;
        }
        const body = { ...payload, store_location_id: myStoreId };
        await updateProductWithImages(payload.id, body);
        toast.success("Produk berhasil diperbarui");
        setShowEdit(false);
        setSelectedProduct(null);
        localStorage.setItem(CACHE_DIRTY_KEY, "1");
        listCache.clear();
        refetch();
      } catch (err) {
        console.error(err?.response?.data || err);
        toast.error(
          err?.response?.data?.message || "Gagal memperbarui produk"
        );
      }
    },
    [myStoreId, refetch]
  );

  /* ====== columns ====== */
  const columns = useMemo(
    () => [
      {
        key: "sku",
        header: "SKU",
        width: "140px",
        sticky: "left",
        className: "font-medium",
        cell: (row) => (
          <span className="font-medium text-gray-900">{row.sku}</span>
        ),
      },
      {
        key: "image",
        header: "Image",
        width: "100px",
        align: "center",
        cell: (row) => (
          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border">
            {row.image_url ? (
              <img
                src={toAbsoluteUrl(row.image_url)}
                alt={row.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-500">
                {(row?.name || "?")[0].toUpperCase()}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "name",
        header: "Product Name",
        width: "260px",
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{row.name}</span>
            <span className="text-xs text-gray-500">
              {row?.category_name || "-"}
              {row?.sub_category_name ? ` • ${row.sub_category_name}` : ""}
            </span>
          </div>
        ),
      },
      {
        key: "price",
        header: "Price",
        width: "130px",
        align: "right",
        cell: (row) => (
          <span className="font-medium">{formatIDR(row.price)}</span>
        ),
      },
      {
        key: "stock",
        header: "Stock",
        width: "110px",
        align: "center",
        cell: (row) => (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass(
              row.stock
            )}`}
          >
            {Number(row.stock ?? 0)}
          </span>
        ),
      },
      {
        key: "unit",
        header: "Unit",
        width: "120px",
        align: "center",
        cell: (row) => {
          const unitName =
            row.unit?.name || row.unit_name || row.unit || "-";
          return (
            <span className="text-xs text-gray-700 whitespace-nowrap">
              {unitName}
            </span>
          );
        },
      },
      {
        key: "store",
        header: "Store",
        width: "180px",
        cell: (row) => (
          <span className="text-sm text-gray-600">
            {row.store_location?.name ||
              (row.store_location_id ? row.store_location_id : "Global")}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Created",
        width: "170px",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {formatDateTime(row.created_at)}
          </div>
        ),
      },
      {
        key: "__actions",
        header: "Action",
        width: "200px",
        sticky: "right",
        align: "center",
        cell: (row) => (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => handleEdit(row)}
              className="w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setConfirmTarget(row);
                setConfirmOpen(true);
              }}
              className="w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit]
  );

  if (myStoreId === undefined) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-4 border">
          Memuat informasi store user...
        </div>
      </div>
    );
  }

  /* ====== UI ====== */
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Products</h2>
        <p className="text-xs text-gray-500">
          Store aktif: <span className="font-medium">{storeName}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Store filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedStore}
                onChange={(e) => {
                  setSelectedStore(e.target.value);
                  setCurrentPage(1);
                  listCache.clear();
                }}
                disabled={storesLoading}
                className="pl-9 pr-8 py-2 border rounded-lg text-sm text-gray-700 appearance-none min-w-[160px] focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <StoreIcon className="w-4 h-4 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <svg
                className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
              </svg>
            </div>
          </div>

          {/* Filter popover */}
          <button
            ref={btnRef}
            onClick={toggleFilters}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {/* Export CSV */}
          <button
            onClick={async () => {
              try {
                toast.loading("Menyiapkan CSV...", { id: "exp" });
                const p = {
                  ...queryParams,
                  page: 1,
                  per_page: meta?.total || 100000,
                };
                const k = stableKey(p);
                const hit = listCacheGet(k);
                const { items } = hit || (await getProducts(p));
                const list = (hit ? hit.items : items || []) || [];

                const headers = [
                  "SKU",
                  "Product Name",
                  "Category",
                  "Sub Category",
                  "Price",
                  "Stock",
                  "Unit",
                  "Store",
                  "Created",
                ];
                const escape = (v) => {
                  if (v == null) return "";
                  const s = String(v);
                  return /[\",\n]/.test(s)
                    ? `"${s.replace(/"/g, '""')}"`
                    : s;
                };
                const rowsCsv = list.map((r) => {
                  const unitName =
                    r.unit?.name || r.unit_name || r.unit || "";
                  return [
                    r.sku,
                    r.name,
                    r.category_name || "",
                    r.sub_category_name || "",
                    formatIDR(r.price),
                    Number(r.stock ?? 0),
                    unitName,
                    r.store_location?.name ||
                      (r.store_location_id ? r.store_location_id : "Global"),
                    formatDateTime(r.created_at),
                  ]
                    .map(escape)
                    .join(",");
                });
                const csv = [headers.join(","), ...rowsCsv].join("\n");
                const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const ts = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace(/[:T]/g, "-");
                a.download = `products-${ts}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("CSV berhasil diunduh", { id: "exp" });
              } catch {
                toast.error("Gagal mengekspor CSV", { id: "exp" });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          {/* Download Template ⬇️ */}
          <button
            onClick={async () => {
              try {
                const blob = await downloadProductImportTemplate();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "product_import_template.xlsx";
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (e) {
                console.error(e);
                toast.error("Gagal mengunduh template");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>

          {/* Import Excel ⬆️ */}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </button>

          {/* Add */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            <DataTable
              columns={columns}
              data={filteredRows}
              loading={loading && !rows.length}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={(p) => {
                setCurrentPage(p);
              }}
              stickyHeader
              getRowKey={(row, i) => row.id ?? row.sku ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Filter Popover */}
      {showFilters && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowFilters(false)}
          />
          <div
            className="fixed z-50 w-96 bg-white rounded-lg shadow-lg border"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={draftCategoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftCategoryId(val);
                    setDraftSubCategoryId((prev) => {
                      if (!prev) return "";
                      const cid = Number(val);
                      const ok = subCategories.some(
                        (s) =>
                          String(s.id) === String(prev) &&
                          Number(s.category_id) === cid
                      );
                      return ok ? prev : "";
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subcategory
                </label>
                <select
                  value={draftSubCategoryId}
                  onChange={(e) => setDraftSubCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All</option>
                  {subCategories
                    .filter(
                      (s) =>
                        !draftCategoryId ||
                        String(s.category_id) === String(draftCategoryId)
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Stock
                </label>
                <select
                  value={draftStockStatus}
                  onChange={(e) => setDraftStockStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All</option>
                  <option value="in">In Stock (&gt;5)</option>
                  <option value="low">Low (1-5)</option>
                  <option value="out">Out (0)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Price Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={draftPriceRange.min}
                    onChange={(e) =>
                      setDraftPriceRange((p) => ({
                        ...p,
                        min: e.target.value,
                      }))
                    }
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={draftPriceRange.max}
                    onChange={(e) =>
                      setDraftPriceRange((p) => ({
                        ...p,
                        max: e.target.value,
                      }))
                    }
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t flex justify-between">
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-600"
              >
                Clear All
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddProduct
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleCreate}
        categories={categories}
        subCategories={subCategories}
      />

      {showEdit && selectedProduct && (
        <UpdateProduct
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            setSelectedProduct(null);
          }}
          onSubmit={handleUpdate}
          categories={categories}
          subCategories={subCategories}
          product={selectedProduct}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Hapus Produk?"
        message={`Produk ${confirmTarget?.name} (SKU: ${confirmTarget?.sku}) akan dihapus permanen.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleting) {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
      />

      {/* Import Excel Modal ⬇️ */}
      {showImport && (
        <ImportExcelModal
          onClose={() => setShowImport(false)}
          onImported={(summary) => {
            toast.success(
              `Import selesai. Created: ${
                summary?.created ?? 0
              }, Updated: ${summary?.updated ?? 0}`
            );
            listCache.clear();
            setCurrentPage(1);
            refetch();
          }}
        />
      )}
    </div>
  );
}
