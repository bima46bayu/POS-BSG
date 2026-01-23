// src/pages/InventoryPage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  Filter,
  Download,
  X,
  Store as StoreIcon,
  ListChecks,
} from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "../components/data-table/DataTable";
import { getProducts } from "../api/products";
import { getCategories, getSubCategories, listSubCategories } from "../api/categories";
import { listStoreLocations } from "../api/storeLocations";
import { getMe } from "../api/users";
import { useNavigate } from "react-router-dom";

const PER_PAGE = 10;
const STORE_KEY = "inventory_store_id";

const toNum = (v) => Number(v ?? 0).toLocaleString("id-ID");
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
const labelFromMap = (m, id) =>
  id == null
    ? "-"
    : m.get(id) ?? m.get(Number(id)) ?? m.get(String(id)) ?? String(id);

export default function InventoryProductsPage() {
  const navigate = useNavigate();

  // ===== USER / ROLE (ADMIN vs CASHIER) =====
  const [me, setMe] = useState(null);
  const isAdmin = useMemo(
    () => String(me?.role || "").toLowerCase() === "admin",
    [me]
  );
  const myStoreId = useMemo(
    () => me?.store_location_id ?? me?.store_location?.id ?? "",
    [me]
  );

  // ===== STORE FILTER =====
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState(
    localStorage.getItem(STORE_KEY) || ""
  );

  // init me + stores
  useEffect(() => {
    (async () => {
      try {
        const meRes = await getMe().catch(() => null);
        setMe(meRes);

        const res = await listStoreLocations({ per_page: 200 }).catch(
          () => ({})
        );
        const items = res?.items ?? res?.data ?? res ?? [];
        const cleanStores = (Array.isArray(items) ? items : [])
          .filter((s) => s?.id && s?.name)
          .map((s) => ({ id: String(s.id), name: s.name }));

        const role = String(meRes?.role || "").toLowerCase();
        if (role === "admin") {
          // default: store id user kalau belum ada di localStorage
          if (!localStorage.getItem(STORE_KEY)) {
            const def =
              meRes?.store_location_id ?? meRes?.store_location?.id;
            if (def) {
              setStoreId(String(def));
              localStorage.setItem(STORE_KEY, String(def));
            }
          }
          setStores(cleanStores);
        } else {
          // cashier → locked ke store sendiri
          const mid =
            meRes?.store_location_id ?? meRes?.store_location?.id;
          const mname = meRes?.store_location?.name || "My Store";
          if (mid) {
            setStoreId(String(mid));
            localStorage.setItem(STORE_KEY, String(mid));
            setStores([{ id: String(mid), name: mname }]);
          } else {
            setStores([]);
          }
        }
      } catch {
        // ignore error
      }
    })();
  }, []);

  const handleChangeStore = (val) => {
    if (!isAdmin) return; // cashier tidak boleh ubah
    setStoreId(val);
    localStorage.setItem(STORE_KEY, val || "");
  };

  // ===== server data & meta =====
  const [rawRows, setRawRows] = useState([]);
  const [serverMeta, setServerMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: PER_PAGE,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  // ===== client states =====
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const [showFilters, setShowFilters] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");

  // anchor popover untuk filter category/subcategory
  const filterBtnRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // options category/subcategory
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  // client filter aktif untuk kategori/subkategori
  const clientFilterActive = Boolean(categoryId || subCategoryId);

  // ===== load categories & subcategories (simple cache 5 menit) =====
  useEffect(() => {
    let cancel = false;

    const toArray = (res) => {
      const payload = res?.data ?? res;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const cached = (() => {
      try {
        const raw = localStorage.getItem("POS_CATEGORIES_CACHE_V1");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (cached?.categories?.length) {
      setCategories(cached.categories);
      setSubCategories(cached.subCategories || []);
    }

    const fetchFresh = async () => {
      try {
        const [catRes, subRes] = await Promise.all([
          getCategories(),
          listSubCategories({ per_page: 1000 }),
        ]);
        if (cancel) return;
        const cats = toArray(catRes);
        const subs = (subRes?.items || []).map((s) => ({
          id: s.id,
          name: s.name,
          category_id: s.category_id,
        }));
        setCategories(cats);
        setSubCategories(subs);
        try {
          localStorage.setItem(
            "POS_CATEGORIES_CACHE_V1",
            JSON.stringify({
              categories: cats,
              subCategories: subs,
              ts: Date.now(),
            })
          );
        } catch {}
      } catch {
        if (!cancel) {
          setCategories([]);
          setSubCategories([]);
        }
      }
    };

    const needFetch =
      !cached || !cached.ts || Date.now() - cached.ts > 5 * 60 * 1000;
    if (needFetch) fetchFresh();

    return () => {
      cancel = true;
    };
  }, []);

  // ===== FETCH LIST (server paging vs client filter mode) =====
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    // === store filter → SAMAKAN DENGAN ProductPage: store_id + only_store
    const storeFilterParam = isAdmin
      ? storeId || null
      : myStoreId
      ? String(myStoreId)
      : null;

    const baseForClient = {
      page: 1,
      per_page: 100000,
      q: searchTerm.trim() || undefined,
      sort: sortKey || undefined,
      dir: sortKey ? sortDir : undefined,
      ...(storeFilterParam
        ? { store_location_id: storeFilterParam, only_store: 1 }
        : {}),
    };

    const baseForServer = {
      page: currentPage,
      per_page: PER_PAGE,
      q: searchTerm.trim() || undefined,
      category_id: categoryId || undefined,
      sub_category_id: subCategoryId || undefined,
      sort: sortKey || undefined,
      dir: sortKey ? sortDir : undefined,
      ...(storeFilterParam
        ? { store_location_id: storeFilterParam, only_store: 1 }
        : {}),
    };

    const params = clientFilterActive ? baseForClient : baseForServer;

    getProducts(params, controller.signal)
      .then(({ items, meta }) => {
        setRawRows(items || []);
        setServerMeta(
          meta || {
            current_page: 1,
            last_page: 1,
            per_page: PER_PAGE,
            total: (items || []).length,
          }
        );
      })
      .catch((err) => {
        const isCanceled =
          err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
        if (!isCanceled) toast.error("Gagal memuat daftar produk");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    searchTerm,
    sortKey,
    sortDir,
    currentPage,
    clientFilterActive,
    categoryId,
    subCategoryId,
    isAdmin,
    storeId,
    myStoreId,
  ]);

  // ===== maps for labels =====
  const catMap = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c.name])),
    [categories]
  );
  const subMap = useMemo(
    () => new Map((subCategories || []).map((s) => [s.id, s.name])),
    [subCategories]
  );

  // ===== client-side filter/sort (saat filter aktif) =====
  const filteredSorted = useMemo(() => {
    let list = rawRows;

    if (clientFilterActive) {
      if (categoryId)
        list = list.filter(
          (r) => String(r.category_id) === String(categoryId)
        );
      if (subCategoryId)
        list = list.filter(
          (r) => String(r.sub_category_id) === String(subCategoryId)
        );

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        list = list.filter(
          (r) =>
            String(r.name || "").toLowerCase().includes(q) ||
            String(r.sku || "").toLowerCase().includes(q)
        );
      }

      if (sortKey) {
        const dir = sortDir === "desc" ? -1 : 1;
        list = [...list].sort((a, b) => {
          const pick = (row) => {
            if (sortKey === "category_id")
              return labelFromMap(catMap, row.category_id);
            if (sortKey === "sub_category_id")
              return labelFromMap(subMap, row.sub_category_id);
            return row[sortKey];
          };
          const va = pick(a);
          const vb = pick(b);
          if (va == null && vb == null) return 0;
          if (va == null) return -1 * dir;
          if (vb == null) return 1 * dir;
          if (
            typeof va === "number" &&
            typeof vb === "number"
          )
            return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }
    }

    // store filter sudah di-handle di backend dengan store_id+only_store
    return list;
  }, [
    rawRows,
    clientFilterActive,
    categoryId,
    subCategoryId,
    searchTerm,
    sortKey,
    sortDir,
    catMap,
    subMap,
  ]);

  // ===== paginate & NORMALIZE meta =====
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
        meta: {
          current_page: curr,
          last_page: last,
          per_page: per,
          total,
        },
      };
    }

    const per = serverMeta?.per_page ?? PER_PAGE;
    const total = serverMeta?.total ?? rawRows.length;
    const last =
      serverMeta?.last_page ??
      Math.max(1, Math.ceil(total / Math.max(1, per)));
    const curr = serverMeta?.current_page ?? currentPage;

    return {
      pageRows: rawRows,
      meta: {
        ...serverMeta,
        per_page: per,
        total,
        last_page: last,
        current_page: curr,
      },
    };
  }, [clientFilterActive, filteredSorted, rawRows, serverMeta, currentPage]);

  // ===== sorting =====
  const handleSort = useCallback(
    (key) => {
      if (!key) return;
      if (sortKey === key)
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
      setCurrentPage(1);
    },
    [sortKey]
  );

  // ===== Columns =====
  const columns = [
    {
      key: "name",
      header: "Product",
      sticky: "left",
      width: "240px",
      className: "font-medium",
      cell: (row) => (
        <span className="text-gray-900">{row.name}</span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "160px",
      cell: (row) => (
        <span className="text-gray-700">{row.sku || "-"}</span>
      ),
    },
    {
      key: "category_id",
      header: "Category",
      width: "200px",
      cell: (row) => (
        <span>{labelFromMap(catMap, row.category_id)}</span>
      ),
    },
    {
      key: "sub_category_id",
      header: "Sub Category",
      width: "220px",
      cell: (row) => (
        <span className="text-gray-700">
          {labelFromMap(subMap, row.sub_category_id)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      width: "120px",
      cell: (row) => (
        <span>{toNum(row.stock ?? row.stock_total ?? 0)}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      width: "140px",
      className: "hidden sm:table-cell",
      cell: (row) => (
        <span className="font-medium">
          {formatIDR(row.price)}
        </span>
      ),
    },
    {
      key: "__actions",
      header: "Actions",
      sticky: "right",
      className: "sticky right-0 z-20 bg-white w-[92px]",
      cell: (row) => (
        <div
          className="sticky right-0 z-20 bg-white flex items-center justify-end gap-2 pr-2"
          style={{
            boxShadow:
              "-6px 0 6px -6px rgba(0,0,0,.12)",
          }}
        >
          <button
            onClick={() =>
              navigate(`/inventory/products/${row.id}`, {
                state: { product: row },
              })
            }
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            title="Detail produk"
          >
            Detail
          </button>
        </div>
      ),
    },
  ];

  // ===== filter popover helpers =====
  const toggleFilter = () => {
    if (!showFilters) {
      const el = filterBtnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const gap = 8,
          width = 320;
        const left = Math.min(
          Math.max(r.right - width, 8),
          window.innerWidth - width - 8
        );
        const top = Math.min(
          r.bottom + gap,
          window.innerHeight - 8
        );
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  };

  // ===== Export CSV =====
  const exportCSV = async () => {
    try {
      toast.loading("Menyiapkan CSV...", { id: "exp" });
      const data = clientFilterActive ? filteredSorted : rawRows;

      const headers = [
        "SKU",
        "Product",
        "Category",
        "Sub Category",
        "Stock",
        "Price",
      ];
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[\",\n]/.test(s)
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };
      const csvRows = (data || []).map((r) => {
        const cat = labelFromMap(catMap, r.category_id);
        const sub = labelFromMap(subMap, r.sub_category_id);
        return [
          r.sku || "-",
          r.name || "-",
          cat,
          sub,
          toNum(r.stock ?? r.stock_total ?? 0),
          formatIDR(r.price),
        ]
          .map(escape)
          .join(",");
      });

      const csv = [headers.join(","), ...csvRows].join("\n");
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
      a.download = `inventory-products-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV berhasil diunduh", { id: "exp" });
    } catch {
      toast.error("Gagal mengekspor CSV", { id: "exp" });
    }
  };

  const appliedFilterCount =
    (categoryId ? 1 : 0) + (subCategoryId ? 1 : 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Inventory Products
        </h2>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search name / SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Store dropdown ala ProductPage */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={isAdmin ? (storeId || "") : storeId}
                onChange={(e) => {
                  if (!isAdmin) return;
                  handleChangeStore(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={!isAdmin || stores.length === 0}
                className="pl-9 pr-8 py-2 border rounded-lg text-sm text-gray-700 appearance-none min-w-[160px] focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
              >
                {isAdmin && <option value="">Semua</option>}
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

          {/* Filter + Export + Reconciliation */}
          <div className="flex items-center gap-2">
            <button
              ref={filterBtnRef}
              onClick={toggleFilter}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
              {appliedFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {appliedFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Reconciliation */}
            <button
              onClick={() => navigate("/inventory/reconciliation")}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              title="Stock Reconciliation"
            >
              <ListChecks className="w-4 h-4" />
              Reconciliation
            </button>
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
              getRowKey={(row, i) => row.id ?? row.sku ?? i}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Overlay filter */}
      {showFilters && (
        <div
          className="fixed inset-0 z-40"
          onMouseDown={() => setShowFilters(false)}
        />
      )}

      {/* Filter Popover */}
      {showFilters && (
        <div
          className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Filters
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubCategoryId("");
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All</option>
                {(categories || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sub Category
              </label>
              <select
                value={subCategoryId}
                onChange={(e) => {
                  setSubCategoryId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All</option>
                {(subCategories || [])
                  .filter(
                    (s) =>
                      !categoryId ||
                      String(s.category_id) === String(categoryId)
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                setCategoryId("");
                setSubCategoryId("");
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
