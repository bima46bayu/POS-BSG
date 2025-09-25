// src/pages/ProductPage.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import DataTable from "../components/data-table/DataTable";
import {
  Calendar,
  Download,
  Filter,
  X,
  Edit,
  Trash2,
  Plus,
  Image as ImageIcon,
  Search,
  Barcode,
  ChevronDown,
} from "lucide-react";
import { toAbsoluteUrl } from "../api/client";
import toast from "react-hot-toast";

import {
  getProducts,
  uploadProductImage,
  deleteProduct,
  createProductWithImages,
  updateProductWithImages, // <--- import update
} from "../api/products";
import AddProduct from "../components/products/AddProduct";
import UpdateProduct from "../components/products/UpdateProduct"; // <--- import modal edit
import { getCategories, getSubCategories } from "../api/categories";
import ConfirmDialog from "../components/common/ConfirmDialog";

const PER_PAGE = 10;

const badgeClass = (n) => {
  const v = Number(n || 0);
  if (v === 0) return "bg-red-100 text-red-800 border border-red-200";
  if (v <= 5) return "bg-yellow-100 text-yellow-800 border border-yellow-200";
  return "bg-green-100 text-green-800 border border-green-200";
};

// debounce util
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// normalisasi subcategory dari struktur categories apa pun
function normalizeSubCategories(cats = []) {
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
}

export default function ProductPage() {
  // table state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // filters (aktif untuk fetch)
  const [searchTerm, setSearchTerm] = useState("");
  const [skuExact, setSkuExact] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState(""); // "", "in", "low", "out"
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  // filter UI
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // DRAFT filters (untuk input UI; commit saat Apply)
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [draftSkuExact, setDraftSkuExact] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftStockStatus, setDraftStockStatus] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState({ min: "", max: "" });

  // data
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    per_page: PER_PAGE,
    total: 0,
    last_page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]); // normalized subs

  // modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false); // <--- baru

  // confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // === PRELOAD: categories + subCategories (fallback) ===
  useEffect(() => {
    let cancel = false;

    (async () => {
      // helper ambil data aman (array) dari berbagai bentuk response
      const toArray = (res) => {
        const payload = res?.data ?? res;
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
      };

      try {
        // 1) Ambil kategori
        const catRes = await getCategories();
        if (cancel) return;
        const catList = toArray(catRes);
        setCategories(catList);

        // 2) Coba turunkan sub dari struktur kategori
        const subsFromCats = normalizeSubCategories(catList);
        if (subsFromCats.length) {
          setSubCategories(subsFromCats);
          return;
        }

        // 3) Fallback: pukul endpoint subcategories langsung (tanpa filter)
        try {
          const subRes = await getSubCategories();
          if (cancel) return;
          const rawSubs = toArray(subRes);
          const normalizedSubs = rawSubs.map((s) => ({
            id: s.id,
            name: s.name,
            category_id:
              s.category_id ?? s.categoryId ?? s.parent_id ?? s.parentId ?? null,
          }));
          setSubCategories(normalizedSubs);
        } catch {
          setSubCategories([]); // tetap jalan tanpa sub
        }
      } catch {
        // kalau kategori gagal, coba minimal ambil sub agar AddProduct masih bisa punya opsi
        try {
          const subRes = await getSubCategories();
          if (cancel) return;
          const rawSubs =
            Array.isArray(subRes?.data?.data)
              ? subRes.data.data
              : Array.isArray(subRes?.data)
              ? subRes.data
              : Array.isArray(subRes)
              ? subRes
              : [];
          const normalizedSubs = rawSubs.map((s) => ({
            id: s.id,
            name: s.name,
            category_id:
              s.category_id ?? s.categoryId ?? s.parent_id ?? s.parentId ?? null,
          }));
          setSubCategories(normalizedSubs);
        } catch {
          setSubCategories([]);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  // posisi & sync draft saat buka filter
  const toggleFilters = useCallback(() => {
    if (!showFilters) {
      setDraftSearchTerm(searchTerm);
      setDraftSkuExact(skuExact);
      setDraftCategoryId(categoryId);
      setDraftStockStatus(stockStatus);
      setDraftPriceRange(priceRange);

      const el = btnRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const gap = 8;
        const width = 384; // w-96
        const left = Math.min(
          Math.max(rect.right - width, 8),
          window.innerWidth - width - 8
        );
        const top = Math.min(rect.bottom + gap, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  }, [showFilters, searchTerm, skuExact, categoryId, stockStatus, priceRange]);

  // debounce untuk pencarian
  const debouncedSearch = useDebounce(searchTerm, 300);

  // build params ke BE
  const queryParams = useMemo(() => {
    const p = { page: currentPage, per_page: PER_PAGE };
    if (skuExact.trim()) p.sku = skuExact.trim();
    else if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (categoryId) p.category_id = categoryId;
    if (priceRange.min) p.price_min = priceRange.min;
    if (priceRange.max) p.price_max = priceRange.max;
    if (sortKey) {
      p.sort = sortKey;
      p.dir = sortDir;
    }
    return p;
  }, [
    currentPage,
    debouncedSearch,
    skuExact,
    categoryId,
    priceRange.min,
    priceRange.max,
    sortKey,
    sortDir,
  ]);

  // fetch products
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    getProducts(queryParams, controller.signal)
      .then(({ items, meta }) => {
        if (cancelled) return;
        setRows(items || []);
        setMeta(meta || {});
      })
      .catch((err) => {
        const isCanceled =
          err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat produk");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [queryParams]);

  // filter stok di FE
  const displayRows = useMemo(() => {
    if (!stockStatus) return rows;
    const thr = (n) => Number(n ?? 0);
    if (stockStatus === "out") return rows.filter((p) => thr(p.stock) === 0);
    if (stockStatus === "low")
      return rows.filter((p) => thr(p.stock) > 0 && thr(p.stock) <= 5);
    if (stockStatus === "in") return rows.filter((p) => thr(p.stock) > 5);
    return rows;
  }, [rows, stockStatus]);

  // refetch
  const refetch = useCallback(() => {
    const controller = new AbortController();
    getProducts(queryParams, controller.signal)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(meta || {});
      })
      .catch(() => {});
  }, [queryParams]);

  // Apply / Clear — commit semua nilai draft
  const applyFilters = useCallback(() => {
    setSearchTerm(draftSearchTerm);
    setSkuExact(draftSkuExact);
    setCategoryId(draftCategoryId);
    setStockStatus(draftStockStatus);
    setPriceRange(draftPriceRange);
    setCurrentPage(1);
    setShowFilters(false);
  }, [
    draftSearchTerm,
    draftSkuExact,
    draftCategoryId,
    draftStockStatus,
    draftPriceRange,
  ]);

  const clearAllFilters = useCallback(() => {
    setDraftSearchTerm("");
    setDraftSkuExact("");
    setDraftCategoryId("");
    setDraftStockStatus("");
    setDraftPriceRange({ min: "", max: "" });

    setSearchTerm("");
    setSkuExact("");
    setCategoryId("");
    setStockStatus("");
    setPriceRange({ min: "", max: "" });
    setCurrentPage(1);
  }, []);

  // handlers
  const handleEdit = useCallback((row) => {
    setSelectedProduct(row);
    setShowEdit(true);
  }, []);

  const openUpload = useCallback((row) => {
    setSelectedProduct(row);
    setFileToUpload(null);
    setShowUploadModal(true);
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!selectedProduct || !fileToUpload) return;
    try {
      await uploadProductImage(selectedProduct.id, fileToUpload);
      toast.success("Image uploaded");
      setShowUploadModal(false);
      refetch();
    } catch {
      toast.error("Gagal upload image");
    }
  }, [fileToUpload, refetch, selectedProduct]);

  const onDelete = useCallback((row) => {
    setConfirmTarget(row);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(
    async () => {
      if (!confirmTarget) return;
      setDeleting(true);
      try {
        await deleteProduct(confirmTarget.id);
        toast.success("Product deleted");
        // atur pagination biar tidak ke halaman kosong
        if (displayRows.length === 1 && (meta.current_page || 1) > 1) {
          setCurrentPage((p) => p - 1);
        } else {
          refetch();
        }
      } catch (e) {
        toast.error("Gagal menghapus produk");
      } finally {
        setDeleting(false);
        setConfirmOpen(false);
        setConfirmTarget(null);
      }
    },
    [confirmTarget, displayRows.length, meta.current_page, refetch]
  );

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

  // create product
  const handleCreate = useCallback(
    async (payload) => {
      try {
        await createProductWithImages(payload);
        toast.success("Produk berhasil dibuat");
        setShowAdd(false);
        setCurrentPage(1);
        refetch();
      } catch (e) {
        console.error(e);
        toast.error("Gagal membuat produk");
      }
    },
    [refetch]
  );

  // update product
  const handleUpdate = useCallback(
    async (payload) => {
      try {
        await updateProductWithImages(payload.id, payload);
        toast.success("Produk berhasil diperbarui");
        setShowEdit(false);
        setSelectedProduct(null);
        refetch();
      } catch (e) {
        console.error(e);
        toast.error("Gagal memperbarui produk");
      }
    },
    [refetch]
  );

  // columns
  const columns = useMemo(
    () => [
      {
        key: "sku",
        label: "SKU",
        sticky: "left",
        sortable: true,
        minWidth: "140px",
        className: "font-medium text-gray-900",
      },
      {
        key: "image_url",
        label: "Image",
        minWidth: "80px",
        align: "center",
        render: (val, row) => (
          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
            {val ? (
              <img
                src={toAbsoluteUrl(val)}
                alt={row.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-500">
                {(row?.name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "name",
        label: "Product Name",
        sortable: true,
        minWidth: "200px",
        render: (v, row) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{v}</span>
            <span className="text-xs text-gray-500">
              {row?.category_name || "-"}
              {row?.sub_category_name ? ` • ${row.sub_category_name}` : ""}
            </span>
          </div>
        ),
      },
      {
        key: "price",
        label: "Price",
        align: "right",
        minWidth: "120px",
        sortable: true,
        className: "font-medium text-gray-900",
        render: (v) => formatIDR(v),
      },
      {
        key: "stock",
        label: "Stock",
        align: "center",
        minWidth: "110px",
        sortable: true,
        render: (v) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass(
              v
            )}`}
          >
            {Number(v ?? 0)}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Created",
        minWidth: "160px",
        sortable: true,
        render: (v) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{formatDateTime(v)}</span>
          </div>
        ),
      },
      {
        key: "actions",
        label: "Action",
        sticky: "right",
        align: "center",
        minWidth: "180px",
        render: (value, row) => (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => handleEdit(row)}
              className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              title="Edit Product"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={() => openUpload(row)}
              className="inline-flex items-center justify-center w-8 h-8 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              title="Upload Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(row)}
              className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600"
              title="Delete Product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit, onDelete, openUpload]
  );

  // Filter popover
  const FilterComponent = useCallback(
    () => (
      <div className="relative w-full">
        <button
          ref={btnRef}
          onClick={toggleFilters}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>

        {showFilters && (
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => setShowFilters(false)}
          />
        )}

        {showFilters && (
          <div
            className="fixed z-50 w-96 bg-white rounded-lg shadow-lg border border-gray-200"
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
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search (name/sku)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={draftSearchTerm}
                    onChange={(e) => setDraftSearchTerm(e.target.value)}
                    placeholder="ketik nama/sku (fuzzy)"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* SKU exact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU (exact)
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={draftSkuExact}
                    onChange={(e) => setDraftSkuExact(e.target.value)}
                    placeholder="SKU-001 (scanner)"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={draftCategoryId}
                    onChange={(e) => setDraftCategoryId(e.target.value)}
                    className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500 bg-white"
                  >
                    <option value="">All</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock
                </label>
                <div className="relative">
                  <select
                    value={draftStockStatus}
                    onChange={(e) => setDraftStockStatus(e.target.value)}
                    className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500 bg-white"
                  >
                    <option value="">All</option>
                    <option value="in">In Stock (&gt;5)</option>
                    <option value="low">Low (1–5)</option>
                    <option value="out">Out (0)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Price range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={draftPriceRange.min}
                    onChange={(e) =>
                      setDraftPriceRange((p) => ({ ...p, min: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={draftPriceRange.max}
                    onChange={(e) =>
                      setDraftPriceRange((p) => ({ ...p, max: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-500"
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    ),
    [
      showFilters,
      popoverPos.top,
      popoverPos.left,
      toggleFilters,
      draftSearchTerm,
      draftSkuExact,
      draftCategoryId,
      draftStockStatus,
      draftPriceRange.min,
      draftPriceRange.max,
      categories,
      applyFilters,
      clearAllFilters,
    ]
  );

  const ActionButtons = useCallback(
    () => (
      <div className="flex items-center gap-3 flex-nowrap">
        <button
          onClick={() => toast("Export coming soon")}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>
    ),
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DataTable
        data={displayRows}
        columns={columns}
        title="Products"
        searchable={true}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          setSkuExact("");
          setCurrentPage(1);
        }}
        sortConfig={{ key: sortKey, direction: sortDir }}
        onSort={handleSort}
        currentPage={meta.current_page || 1}
        totalPages={meta.last_page || 1}
        onPageChange={(p) => setCurrentPage(p)}
        startIndex={((meta.current_page || 1) - 1) * (meta.per_page || PER_PAGE)}
        endIndex={Math.min(
          (meta.current_page || 1) * (meta.per_page || PER_PAGE),
          meta.total || displayRows.length
        )}
        totalItems={meta.total ?? displayRows.length}
        filterComponent={<FilterComponent />}
        actions={<ActionButtons />}
        loading={loading}
      />

      {/* Add Product (popup) */}
      <AddProduct
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleCreate}
        categories={categories}
        subCategories={subCategories}
      />

      {/* Edit Product (popup) */}
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

      {/* Upload Image Modal */}
      {showUploadModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-full">
                  <ImageIcon className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Upload Image
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedProduct.name} (SKU: {selectedProduct.sku})
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
              <p className="text-xs text-gray-500 mt-2">jpg/jpeg/png, max 2MB</p>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-800"
                  disabled={!fileToUpload}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus Produk?"
        message={
          <span className="text-sm text-gray-700">
            Produk{" "}
            <span className="font-semibold text-gray-900">
              {confirmTarget?.name}
            </span>{" "}
            (SKU: {confirmTarget?.sku}) akan dihapus permanen. Tindakan ini tidak
            dapat dibatalkan.
          </span>
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

// helpers
function formatIDR(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}
function formatDateTime(s) {
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
}
