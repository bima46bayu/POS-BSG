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
  Download,
  Filter,
  X,
  Edit,
  Trash2,
  Plus,
  Search,
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
import { getCategories, listSubCategories } from "../api/categories";
import { getMe } from "../api/users";

import AddProduct from "../components/products/AddProduct";
import UpdateProduct from "../components/products/UpdateProduct";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DataTable from "../components/data-table/DataTable";
import ImportExcelModal from "../components/products/ImportExcelModal";

const PER_PAGE = 10;
const CACHE_KEY = "POS_CATEGORIES_CACHE_V1";
const CACHE_DIRTY_KEY = "POS_CATS_DIRTY";
const CAT_CACHE_TTL_MS = 5 * 60 * 1000;
const LIST_CACHE_TTL_MS = 60 * 1000;
const LIST_CACHE_MAX = 50;

/* ========= Cache utilities ========= */
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

// LRU cache untuk list products
const listCache = new Map();

const listCacheGet = (key) => {
  const hit = listCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > LIST_CACHE_TTL_MS) {
    listCache.delete(key);
    return null;
  }
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

const stableKey = (obj) => {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((a, k) => ((a[k] = obj[k]), a), {});
  return JSON.stringify(sorted);
};

/* ========= UI utilities ========= */
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

/* ========= Hooks ========= */
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

  /* ====== User store ====== */
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

  /* ====== Filters ====== */
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

  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftSubCategoryId, setDraftSubCategoryId] = useState("");
  const [draftStockStatus, setDraftStockStatus] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState({
    min: "",
    max: "",
  });

  /* ====== Data ====== */
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

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => {
      if (c?.id != null) m[String(c.id)] = c.name;
    });
    return m;
  }, [categories]);

  const subCategoryMap = useMemo(() => {
    const m = {};
    subCategories.forEach((s) => {
      if (s?.id != null) m[String(s.id)] = s.name;
    });
    return m;
  }, [subCategories]);

  /* ====== Modal & Actions ====== */
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /* ====== Load Categories ====== */
  useEffect(() => {
    let cancel = false;

    const toArray = (res) => {
      const payload = res?.data ?? res;
      return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
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
        const [catRes, subRes] = await Promise.all([
          getCategories(),
          listSubCategories({ per_page: 1000 }),
        ]);

        if (cancel) return;

        const catList = toArray(catRes);
        const subs = (subRes?.items || []).map((s) => ({
          id: s.id,
          name: s.name,
          category_id: s.category_id,
        }));

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

  /* ====== Query Builder ====== */
  const queryParams = useMemo(() => {
    const p = { page: currentPage, per_page: PER_PAGE };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (categoryId) p.category_id = categoryId;
    if (subCategoryId) p.sub_category_id = subCategoryId;
    if (priceRange.min) p.min_price = priceRange.min;
    if (priceRange.max) p.max_price = priceRange.max;
    return p;
  }, [
    currentPage,
    debouncedSearch,
    categoryId,
    subCategoryId,
    priceRange.min,
    priceRange.max,
  ]);

  const queryKey = useMemo(() => stableKey(queryParams), [queryParams]);

  /* ====== Fetch List ====== */
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

      // Prefetch next page
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
      setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [fetchList, myStoreId, queryKey, queryParams, startTransition]);

  useEffect(() => {
    if (myStoreId !== undefined) refetch();
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [refetch, myStoreId]);

  /* ====== Filter Stock (Front-end) ====== */
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

  /* ====== UI Helpers ====== */
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

  /* ====== CRUD Handlers ====== */
  const handleEdit = useCallback((row) => {
    setSelectedProduct(row);
    setShowEdit(true);
  }, []);

  const handleDelete = useCallback((row) => {
    setConfirmTarget(row);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmTarget.id);
      toast.success("Produk berhasil dihapus");
      listCache.clear();
      if (filteredRows.length === 1 && (meta.current_page || 1) > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        refetch();
      }
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

  const handleExportExcel = useCallback(async () => {
    try {
      toast.loading("Menyiapkan Excel...", { id: "exp" });
      const XLSX = await import("xlsx");
      
      const p = {
        ...queryParams,
        page: 1,
        per_page: meta?.total || 100000,
      };
      const k = stableKey(p);
      const hit = listCacheGet(k);
      const { items } = hit || (await getProducts(p));
      const list = (hit ? hit.items : items || []) || [];

      const data = list.map((r) => {
        const unitName = r.unit?.name || r.unit_name || r.unit || "";
        const catName = categoryMap[String(r.category_id)] || "";
        const subName = subCategoryMap[String(r.sub_category_id)] || "";
        const storeName = r.store_location?.name || "Global";

        return {
          SKU: r.sku,
          "Product Name": r.name,
          Category: catName,
          "Sub Category": subName,
          Price: formatIDR(r.price),
          Stock: Number(r.stock ?? 0),
          Unit: unitName,
          Store: storeName,
          "Created At": formatDateTime(r.created_at),
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      
      const ts = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `products-${ts}.xlsx`);
      
      toast.success("Excel berhasil diunduh", { id: "exp" });
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor Excel", { id: "exp" });
    }
  }, [queryParams, meta?.total, categoryMap, subCategoryMap]);

  const handleDownloadTemplate = useCallback(async () => {
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
  }, []);

  const truncateWords = (text, wordLimit = 8) => {
    if (!text) return "";
    const words = String(text).split(" ");
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(" ") + "...";
  };

  /* ====== Columns ====== */
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
        width: "280px",
        cell: (row) => (
          <span className="text-gray-700 text-xs" title={row.name}>
            {truncateWords(row.name, 8)}
          </span>
        ),
      },
      {
        key: "category",
        header: "Category",
        width: "120px",
        cell: (row) => {
          const catName = categoryMap[String(row.category_id)] || "-";
          const subName = subCategoryMap[String(row.sub_category_id)] || "";
          return (
            <div className="flex flex-col">
              <span className="text-xs text-gray-800">{catName}</span>
              <span className="text-xs text-gray-500">{subName}</span>
            </div>
          );
        },
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
        width: "100px",
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
        key: "__actions",
        header: "Action",
        width: "180px",
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
              onClick={() => handleDelete(row)}
              className="w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete, categoryMap, subCategoryMap]
  );

  /* ====== Render ====== */
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

          {/* Filter */}
          <button
            ref={btnRef}
            onClick={toggleFilters}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>

          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>

          {/* Import Excel */}
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
              loading={loading}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={setCurrentPage}
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
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear All
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
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