// src/pages/ProductPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Calendar, Download, Filter, X, Edit, Trash2, Plus, Image as ImageIcon, Search } from "lucide-react";
import { toAbsoluteUrl } from "../api/client";
import toast from "react-hot-toast";
import {
  getProducts,
  uploadProductImage,
  deleteProduct,
  createProductWithImages,
  updateProductWithImages,
} from "../api/products";
import AddProduct from "../components/products/AddProduct";
import UpdateProduct from "../components/products/UpdateProduct";
import { getCategories, getSubCategories } from "../api/categories";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DataTable from "../components/data-table/DataTable";

const PER_PAGE = 10;

const badgeClass = (n) => {
  const v = Number(n || 0);
  if (v === 0) return "bg-red-100 text-red-800";
  if (v <= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
};

function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function normalizeSubCategories(cats = []) {
  const out = [];
  cats.forEach((c) => {
    const children = c.sub_categories || c.subCategories || c.children || c.subs || [];
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

export default function ProductPage() {
  // ====== query state ======
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [skuExact, setSkuExact] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  // filter popover
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // draft filter (di popover)
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [draftSkuExact, setDraftSkuExact] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftStockStatus, setDraftStockStatus] = useState("");
  const [draftPriceRange, setDraftPriceRange] = useState({ min: "", max: "" });

  // data state
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

  // modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ====== load categories & subs ======
  useEffect(() => {
    let cancel = false;
    const toArray = (res) => {
      const payload = res?.data ?? res;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    (async () => {
      try {
        const catRes = await getCategories();
        if (cancel) return;
        const catList = toArray(catRes);
        setCategories(catList);

        const subsFromCats = normalizeSubCategories(catList);
        if (subsFromCats.length) {
          setSubCategories(subsFromCats);
          return;
        }

        try {
          const subRes = await getSubCategories();
          if (cancel) return;
          const rawSubs = toArray(subRes);
          const normalizedSubs = rawSubs.map((s) => ({
            id: s.id,
            name: s.name,
            category_id: s.category_id ?? s.categoryId ?? s.parent_id ?? s.parentId ?? null,
          }));
          setSubCategories(normalizedSubs);
        } catch {
          setSubCategories([]);
        }
      } catch {
        setSubCategories([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  // ====== filters & fetch ======
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
        const width = 384;
        const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
        const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  }, [showFilters, searchTerm, skuExact, categoryId, stockStatus, priceRange]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const queryParams = useMemo(() => {
    const p = { page: currentPage, per_page: PER_PAGE };
    if (skuExact.trim()) p.sku = skuExact.trim();
    else if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (categoryId) p.category_id = categoryId;
    if (priceRange.min) p.price_min = priceRange.min;
    if (priceRange.max) p.price_max = priceRange.max;
    return p;
  }, [currentPage, debouncedSearch, skuExact, categoryId, priceRange]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    getProducts(queryParams, controller.signal)
      .then(({ items, meta }) => {
        if (cancelled) return;
        setRows(items || []);
        setMeta(meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
      })
      .catch((err) => {
        if (err?.name !== "CanceledError") toast.error("Gagal memuat produk");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [queryParams]);

  const displayRows = useMemo(() => {
    if (!stockStatus) return rows;
    const thr = (n) => Number(n ?? 0);
    if (stockStatus === "out") return rows.filter((p) => thr(p.stock) === 0);
    if (stockStatus === "low") return rows.filter((p) => thr(p.stock) > 0 && thr(p.stock) <= 5);
    if (stockStatus === "in") return rows.filter((p) => thr(p.stock) > 5);
    return rows;
  }, [rows, stockStatus]);

  const refetch = useCallback(() => {
    getProducts(queryParams)
      .then(({ items, meta }) => {
        setRows(items || []);
        setMeta(meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
      })
      .catch(() => {});
  }, [queryParams]);

  const applyFilters = useCallback(() => {
    setSearchTerm(draftSearchTerm);
    setSkuExact(draftSkuExact);
    setCategoryId(draftCategoryId);
    setStockStatus(draftStockStatus);
    setPriceRange(draftPriceRange);
    setCurrentPage(1);
    setShowFilters(false);
  }, [draftSearchTerm, draftSkuExact, draftCategoryId, draftStockStatus, draftPriceRange]);

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

  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmTarget.id);
      toast.success("Product deleted");
      if (displayRows.length === 1 && (meta.current_page || 1) > 1) {
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
  }, [confirmTarget, displayRows.length, meta.current_page, refetch]);

  const handleCreate = useCallback(
    async (payload) => {
      try {
        await createProductWithImages(payload);
        toast.success("Produk berhasil dibuat");
        setShowAdd(false);
        setCurrentPage(1);
        refetch();
      } catch {
        toast.error("Gagal membuat produk");
      }
    },
    [refetch]
  );

  const handleUpdate = useCallback(
    async (payload) => {
      try {
        await updateProductWithImages(payload.id, payload);
        toast.success("Produk berhasil diperbarui");
        setShowEdit(false);
        setSelectedProduct(null);
        refetch();
      } catch {
        toast.error("Gagal memperbarui produk");
      }
    },
    [refetch]
  );

  // ====== columns untuk DataTable ======
  const columns = useMemo(
    () => [
      {
        key: "sku",
        header: "SKU",
        width: "140px",
        sticky: "left",
        className: "font-medium",
        cell: (row) => <span className="font-medium text-gray-900">{row.sku}</span>,
      },
      {
        key: "image",
        header: "Image",
        width: "100px",
        align: "center",
        cell: (row) => (
          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border">
            {row.image_url ? (
              <img src={toAbsoluteUrl(row.image_url)} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-500">{(row?.name || "?")[0].toUpperCase()}</span>
            )}
          </div>
        ),
      },
      {
        key: "name",
        header: "Product Name",
        width: "240px",
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
        cell: (row) => <span className="font-medium">{formatIDR(row.price)}</span>,
      },
      {
        key: "stock",
        header: "Stock",
        width: "110px",
        align: "center",
        cell: (row) => (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass(row.stock)}`}>
            {Number(row.stock ?? 0)}
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
    ],
    []
  );

  // ====== export CSV (semua data sesuai filter) ======
  const exportCSV = async () => {
    try {
      toast.loading("Menyiapkan CSV...", { id: "exp" });
      const p = { ...queryParams, page: 1, per_page: meta?.total || 100000 };
      const { items } = await getProducts(p);

      const headers = ["SKU", "Product Name", "Category", "Sub Category", "Price", "Stock", "Created"];
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const rowsCsv = (items || []).map((r) =>
        [
          r.sku,
          r.name,
          r.category_name || "",
          r.sub_category_name || "",
          formatIDR(r.price),
          Number(r.stock ?? 0),
          formatDateTime(r.created_at),
        ]
          .map(escape)
          .join(",")
      );

      const csv = [headers.join(","), ...rowsCsv].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `products-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV berhasil diunduh", { id: "exp" });
    } catch (e) {
      toast.error("Gagal mengekspor CSV", { id: "exp" });
    }
  };

  // ====== render ======
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* SECTION 1: Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Products</h2>
      </div>

      {/* SECTION 2: Controls (Search + Filter + Export + Add) sejajar */}
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
                setSkuExact("");
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              ref={btnRef}
              onClick={toggleFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Table (horizontal scroll) */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            <DataTable
              columns={[
                ...columns,
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
                        onClick={() => openUpload(row)}
                        className="w-8 h-8 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center"
                        title="Upload Image"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        className="w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={displayRows}
              loading={loading}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={setCurrentPage}
              stickyHeader
              // fokus ke horizontal scroll → tanpa maxHeight
              getRowKey={(row, i) => row.id ?? row.sku ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Filter Popover */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
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
                <label className="block text-sm font-medium mb-1">Search</label>
                <input
                  type="text"
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Name or SKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SKU Exact</label>
                <input
                  type="text"
                  value={draftSkuExact}
                  onChange={(e) => setDraftSkuExact(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="SKU-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={draftCategoryId}
                  onChange={(e) => setDraftCategoryId(e.target.value)}
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
                <label className="block text-sm font-medium mb-1">Stock</label>
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
                <label className="block text-sm font-medium mb-1">Price Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={draftPriceRange.min}
                    onChange={(e) => setDraftPriceRange((p) => ({ ...p, min: e.target.value }))}
                    className="px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={draftPriceRange.max}
                    onChange={(e) => setDraftPriceRange((p) => ({ ...p, max: e.target.value }))}
                    className="px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-between">
              <button onClick={clearAllFilters} className="text-sm text-gray-600">
                Clear All
              </button>
              <button onClick={applyFilters} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg">
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

      {showUploadModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Upload Image</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedProduct.name} (SKU: {selectedProduct.sku})
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFileToUpload(e.target.files?.[0])}
              className="w-full border rounded-lg p-2 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                disabled={!fileToUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
