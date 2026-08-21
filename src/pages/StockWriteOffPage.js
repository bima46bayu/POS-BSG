// src/pages/StockWriteOffPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash, X, Check, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../components/data-table/DataTable";
import StoreScopeFilter from "../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { getProducts } from "../api/products";
import {
  createWriteOff,
  updateWriteOff,
  submitWriteOff,
  deleteWriteOff,
  getWriteOffSummary,
  listWriteOffs,
} from "../api/stockWriteOffs";
import { listUnits } from "../api/units";
import { IDR } from "../lib/fmt";

const BRANCH_STORAGE_KEY = "write_off_store_id";
const PARENT_STORAGE_KEY = "write_off_parent_store_id";
const PER_PAGE = 20;

const REASONS = [
  { value: "WASTE", label: "Waste" },
  { value: "SPOILED", label: "Spoiled" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "OTHER", label: "Other" },
];

const REASON_STYLE = {
  WASTE: "bg-amber-50 text-amber-700 border-amber-200",
  SPOILED: "bg-rose-50 text-rose-700 border-rose-200",
  EXPIRED: "bg-purple-50 text-purple-700 border-purple-200",
  DAMAGED: "bg-orange-50 text-orange-700 border-orange-200",
  OTHER: "bg-slate-50 text-slate-700 border-slate-200",
};
const fmtDateTime = (s) =>
  s
    ? new Date(s).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

function productUnitName(p) {
  return p?.unit_name || p?.unit?.name || "";
}
function productUnitId(p) {
  return p?.unit_id ?? p?.unit?.id ?? "";
}

function normalizeUnitKey(name) {
  const key = String(name || "").toLowerCase().trim();
  const map = {
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    g: "g",
    gr: "g",
    gram: "g",
    grams: "g",
    l: "l",
    liter: "l",
    litre: "l",
    ltr: "l",
    ml: "ml",
    milliliter: "ml",
    millilitre: "ml",
  };
  return map[key] || key;
}

function unitFamily(name) {
  const key = normalizeUnitKey(name);
  if (key === "kg" || key === "g") return "mass";
  if (key === "l" || key === "ml") return "volume";
  return "other";
}

function compatibleUnits(allUnits, stockUnitName) {
  if (!stockUnitName) return allUnits;
  const family = unitFamily(stockUnitName);
  if (family === "mass") {
    return allUnits.filter((u) => unitFamily(u.name) === "mass");
  }
  if (family === "volume") {
    return allUnits.filter((u) => unitFamily(u.name) === "volume");
  }
  const stockKey = normalizeUnitKey(stockUnitName);
  return allUnits.filter((u) => normalizeUnitKey(u.name) === stockKey);
}

function writeOffUnitLabel(r) {
  return (
    r.qty_unit?.name ||
    r.qtyUnit?.name ||
    r.product?.unit?.name ||
    r.product?.unit_name ||
    ""
  );
}

function WriteOffModal({ open, onClose, storeId, onSubmit, saving, initial }) {
  const isEdit = !!initial;
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [qtyUnitId, setQtyUnitId] = useState("");
  const [reason, setReason] = useState("WASTE");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setProductId(String(initial.product_id || initial.product?.id || ""));
      setQty(String(initial.qty ?? ""));
      setQtyUnitId(
        String(
          initial.qty_unit_id ??
            initial.qty_unit?.id ??
            initial.qtyUnit?.id ??
            initial.product?.unit_id ??
            initial.product?.unit?.id ??
            ""
        )
      );
      setReason(initial.reason || "WASTE");
      setNote(initial.note || "");
      setSearch(initial.product?.name || "");
      setDebounced(initial.product?.name || "");
    } else {
      setProductId("");
      setQty("");
      setQtyUnitId("");
      setReason("WASTE");
      setNote("");
      setSearch("");
      setDebounced("");
    }
  }, [open, initial]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const productsQ = useQuery({
    enabled: open && storeId != null,
    queryKey: ["write-off-products", { storeId, search: debounced }],
    queryFn: ({ signal }) =>
      getProducts(
        {
          page: 1,
          per_page: 50,
          search: debounced || "",
          store_location_id: storeId,
        },
        signal
      ),
    keepPreviousData: true,
  });

  const unitsQ = useQuery({
    queryKey: ["units-for-write-off"],
    enabled: open,
    queryFn: () => listUnits({ per_page: 200 }),
    staleTime: 120_000,
  });

  const units = unitsQ.data || [];
  const products = productsQ.data?.items || [];
  const selectedFromList = products.find(
    (p) => String(p.id) === String(productId)
  );
  const selected =
    selectedFromList ||
    (initial && String(initial.product_id) === String(productId)
      ? initial.product
      : null);
  const productOptions =
    selected && !selectedFromList
      ? [selected, ...products]
      : products;

  const stockUnitName = productUnitName(selected);
  const qtyUnits = useMemo(
    () => compatibleUnits(units, stockUnitName),
    [units, stockUnitName]
  );
  const defaultUnitId = String(productUnitId(selected) || qtyUnits[0]?.id || "");

  // When product changes, default unit to stock unit if empty / incompatible.
  useEffect(() => {
    if (!open || !productId) return;
    const allowed = qtyUnits.some((u) => String(u.id) === String(qtyUnitId));
    if (!qtyUnitId || !allowed) {
      if (defaultUnitId) setQtyUnitId(defaultUnitId);
    }
  }, [open, productId, defaultUnitId, qtyUnits, qtyUnitId]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!productId) return toast.error("Pilih produk dulu");
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Qty harus > 0");
    if (!qtyUnitId) return toast.error("Pilih satuan (Unit)");
    onSubmit({
      ...(isEdit ? { id: initial.id } : { store_location_id: storeId }),
      product_id: Number(productId),
      qty: n,
      qty_unit_id: Number(qtyUnitId),
      reason,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              {isEdit ? "Edit Draft Write-off" : "Catat Write-off (Draft)"}
            </h3>
            <p className="text-xs text-gray-500">
              Disimpan sebagai draft — stok belum berkurang sampai di-Submit.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cari produk
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama / SKU produk"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produk
            </label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setQtyUnitId("");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">
                {productsQ.isFetching ? "Memuat produk..." : "-- Pilih Produk --"}
              </option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-gray-500 mt-1">
                Stok saat ini: <b>{selected.stock ?? "-"}</b>
                {stockUnitName ? ` ${stockUnitName}` : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_5.5rem_1fr] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="50"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={qtyUnitId}
                onChange={(e) => setQtyUnitId(e.target.value)}
                disabled={!productId}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
              >
                <option value="">Unit</option>
                {qtyUnits.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alasan
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {stockUnitName ? (
            <p className="text-[11px] text-gray-500 -mt-2">
              Boleh isi dalam satuan kecil (contoh <b>g</b> / <b>Ml</b>). Saat
              Submit dikonversi ke stok (<b>{stockUnitName}</b>).
            </p>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan (opsional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: rusak saat penyimpanan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Simpan Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function StockWriteOffPage() {
  const qc = useQueryClient();
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);

  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMe();
        if (!cancelled) setMe(res || null);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listStoreLocations({ page: 1, per_page: 200 })
      .then((res) => {
        if (!cancelled) setStores(res?.items || []);
      })
      .catch(() => {
        if (!cancelled) setStores([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  } = useStoreScopeFilter({
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    setPage(1);
  }, [effectiveStoreId, reason, statusFilter, from, to, debouncedSearch]);

  const params = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      ...(effectiveStoreId != null
        ? { store_location_id: effectiveStoreId }
        : {}),
      ...(reason ? { reason } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, effectiveStoreId, reason, statusFilter, from, to, debouncedSearch]
  );

  const listQ = useQuery({
    enabled: effectiveStoreId != null,
    queryKey: ["write-offs", params],
    queryFn: ({ signal }) => listWriteOffs(params, signal),
    keepPreviousData: true,
  });

  const summaryQ = useQuery({
    enabled: effectiveStoreId != null,
    queryKey: [
      "write-offs-summary",
      { storeId: effectiveStoreId, from, to },
    ],
    queryFn: ({ signal }) =>
      getWriteOffSummary(
        {
          ...(effectiveStoreId != null
            ? { store_location_id: effectiveStoreId }
            : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
        signal
      ),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["write-offs"] });
    qc.invalidateQueries({ queryKey: ["write-offs-summary"] });
    qc.invalidateQueries({ queryKey: ["inventory-products"] });
    qc.invalidateQueries({ queryKey: ["products"], exact: false });
  };

  const createM = useMutation({
    mutationFn: (payload) => createWriteOff(payload),
    onSuccess: () => {
      toast.success("Draft tersimpan — stok belum berkurang. Submit bila sudah benar.");
      setModalOpen(false);
      setEditTarget(null);
      invalidateAll();
    },
    onError: (e) => {
      const res = e?.response?.data;
      const msg =
        res?.errors?.qty?.[0] || res?.message || "Gagal menyimpan draft";
      toast.error(msg);
    },
  });

  const updateM = useMutation({
    mutationFn: ({ id, ...payload }) => updateWriteOff(id, payload),
    onSuccess: () => {
      toast.success("Draft diperbarui");
      setModalOpen(false);
      setEditTarget(null);
      invalidateAll();
    },
    onError: (e) => {
      const res = e?.response?.data;
      const msg =
        res?.errors?.qty?.[0] || res?.message || "Gagal memperbarui draft";
      toast.error(msg);
    },
  });

  const submitM = useMutation({
    mutationFn: (id) => submitWriteOff(id),
    onSuccess: () => {
      toast.success("Write-off di-submit — stok berkurang (FIFO)");
      invalidateAll();
    },
    onError: (e) => {
      const res = e?.response?.data;
      const msg =
        res?.errors?.qty?.[0] || res?.message || "Gagal submit write-off";
      toast.error(msg);
    },
  });

  const deleteM = useMutation({
    mutationFn: (id) => deleteWriteOff(id),
    onSuccess: () => {
      toast.success("Draft dihapus");
      invalidateAll();
    },
    onError: (e) => {
      const res = e?.response?.data;
      const msg =
        res?.errors?.status?.[0] || res?.message || "Gagal hapus draft";
      toast.error(msg);
    },
  });

  const columns = useMemo(
    () => [
      {
        key: "created_at",
        header: "Waktu",
        width: "170px",
        cell: (r) => fmtDateTime(r.created_at),
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        cell: (r) => {
          const draft = (r.status || "submitted") === "draft";
          return (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${
                draft
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {draft ? "Draft" : "Submitted"}
            </span>
          );
        },
      },
      {
        key: "product",
        header: "Produk",
        cell: (r) => (
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {r.product?.name || `#${r.product_id}`}
            </div>
            {r.product?.sku && (
              <div className="text-xs text-gray-500">{r.product.sku}</div>
            )}
          </div>
        ),
      },
      {
        key: "reason",
        header: "Alasan",
        width: "120px",
        cell: (r) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${
              REASON_STYLE[r.reason] || REASON_STYLE.OTHER
            }`}
          >
            {REASONS.find((x) => x.value === r.reason)?.label || r.reason}
          </span>
        ),
      },
      {
        key: "qty",
        header: "Qty",
        align: "right",
        width: "110px",
        cell: (r) => {
          const uom = writeOffUnitLabel(r);
          return (
            <span className="font-medium">
              {Number(r.qty).toLocaleString("id-ID", {
                maximumFractionDigits: 4,
              })}
              {uom ? ` ${uom}` : ""}
            </span>
          );
        },
      },
      {
        key: "total_cost",
        header: "Nilai (COGS)",
        align: "right",
        width: "140px",
        cell: (r) =>
          (r.status || "submitted") === "draft" ? (
            <span className="text-gray-400 text-xs">Setelah submit</span>
          ) : (
            IDR(r.total_cost)
          ),
      },
      {
        key: "user",
        header: "Oleh",
        width: "140px",
        cell: (r) => r.user?.name || "-",
      },
      {
        key: "note",
        header: "Catatan",
        cell: (r) => (
          <span className="text-gray-600">{r.note || "-"}</span>
        ),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "180px",
        cell: (r) => {
          const draft = (r.status || "submitted") === "draft";
          if (!draft) {
            return <span className="text-xs text-gray-400">Terkunci</span>;
          }
          const busy =
            submitM.isPending || updateM.isPending || deleteM.isPending;
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Edit draft"
                disabled={busy}
                onClick={() => {
                  setEditTarget(r);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                title="Submit — stok berkurang"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Submit write-off ${r.product?.name || ""} (${r.qty})? Stok akan berkurang.`
                    )
                  ) {
                    submitM.mutate(r.id);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Submit
              </button>
              <button
                type="button"
                title="Hapus draft"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Hapus draft write-off ini?")) {
                    deleteM.mutate(r.id);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-rose-200 text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [submitM.isPending, updateM.isPending, deleteM.isPending]
  );

  const summary = summaryQ.data;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Trash className="w-5 h-5 text-rose-600" />
            Waste / Write-off
          </h1>
          <p className="text-sm text-gray-500">
            Catat waste/spoiled/expired sebagai <b>draft</b>, perbaiki bila
            salah, lalu <b>Submit</b> agar stok berkurang (FIFO).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StoreScopeFilter
            stores={stores}
            me={me}
            parentId={parentFilterId}
            branchId={storeFilterId}
            onParentChange={handleParentChange}
            onBranchChange={handleBranchChange}
            canPickStore={canPickStore}
            lockedLabel={activeStoreLabel}
          />
          <button
            onClick={() => {
              setEditTarget(null);
              setModalOpen(true);
            }}
            disabled={effectiveStoreId == null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Catat Write-off
          </button>
        </div>
      </div>

      {needsStoreSelection && (
        <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Pilih parent store dan cabang untuk melihat atau mencatat write-off.
        </div>
      )}

      {!needsStoreSelection && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {(summary?.by_reason || []).map((row) => (
              <div
                key={row.reason}
                className="bg-white rounded-lg border border-gray-200 p-3"
              >
                <div className="text-xs text-gray-500">{row.label}</div>
                <div className="text-lg font-semibold text-gray-900">
                  {Number(row.qty || 0).toLocaleString("id-ID", {
                    maximumFractionDigits: 4,
                  })}
                </div>
                <div className="text-xs text-gray-500">{IDR(row.cost)}</div>
              </div>
            ))}
            <div className="bg-slate-900 text-white rounded-lg p-3">
              <div className="text-xs text-slate-300">Total</div>
              <div className="text-lg font-semibold">
                {Number(summary?.total_qty ?? 0).toLocaleString("id-ID", {
                  maximumFractionDigits: 4,
                })}
              </div>
              <div className="text-xs text-slate-300">
                {IDR(summary?.total_cost)}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk / SKU..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Semua alasan</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Semua status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
              </select>

              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              {(reason || statusFilter || from || to || search) && (
                <button
                  onClick={() => {
                    setReason("");
                    setStatusFilter("");
                    setFrom("");
                    setTo("");
                    setSearch("");
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="mt-4">
            <DataTable
              columns={columns}
              data={listQ.data?.items || []}
              loading={listQ.isLoading}
              emptyText="Belum ada write-off"
              meta={
                listQ.data?.meta || {
                  current_page: 1,
                  last_page: 1,
                  per_page: PER_PAGE,
                  total: 0,
                }
              }
              currentPage={page}
              onPageChange={setPage}
              getRowKey={(row) => row.id}
            />
          </div>
        </>
      )}

      <WriteOffModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        storeId={effectiveStoreId}
        initial={editTarget}
        saving={createM.isPending || updateM.isPending}
        onSubmit={(payload) => {
          if (payload.id) {
            const { id, ...rest } = payload;
            updateM.mutate({ id, ...rest });
          } else {
            createM.mutate(payload);
          }
        }}
      />
    </div>
  );
}
