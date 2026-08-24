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
  createWriteOffBatch,
  updateWriteOffBatch,
  submitWriteOffBatch,
  deleteWriteOffBatch,
  getWriteOffSummary,
  listWriteOffBatches,
} from "../api/stockWriteOffs";
import { listUnits } from "../api/units";
import { IDR } from "../lib/fmt";
import {
  compatibleUnits,
  formatUnitLabel,
  matchUnitId,
} from "../lib/units";

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

function defaultQtyUnitId(product, units) {
  const allowed = compatibleUnits(units, productUnitName(product));
  const stockId = productUnitId(product);
  if (stockId && allowed.some((u) => String(u.id) === String(stockId))) {
    return String(stockId);
  }
  return matchUnitId(allowed, productUnitName(product));
}

function unitsForProduct(units, product) {
  const allowed = compatibleUnits(units, productUnitName(product));
  const preferred = defaultQtyUnitId(product, units);
  return [...allowed].sort((a, b) => {
    const aHit = String(a.id) === String(preferred) ? 0 : 1;
    const bHit = String(b.id) === String(preferred) ? 0 : 1;
    if (aHit !== bHit) return aHit - bHit;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
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

function emptyWriteOffRow(reason = "WASTE") {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    qty: "",
    qtyUnitId: "",
    reason,
    note: "",
  };
}

function WriteOffModal({ open, onClose, storeId, onSubmit, saving, initial }) {
  const isEdit = !!initial;
  const [rows, setRows] = useState(() => [emptyWriteOffRow()]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) return;
    const lines = Array.isArray(initial?.items) ? initial.items : [];
    if (lines.length) {
      setRows(
        lines.map((line) => ({
          key: `edit-${line.id}`,
          id: line.id,
          productId: String(line.product_id || line.product?.id || ""),
          qty: String(line.qty ?? ""),
          qtyUnitId: String(
            line.qty_unit_id ??
              line.qty_unit?.id ??
              line.qtyUnit?.id ??
              line.product?.unit_id ??
              line.product?.unit?.id ??
              ""
          ),
          reason: line.reason || "WASTE",
          note: line.note || "",
        }))
      );
    } else {
      setRows([emptyWriteOffRow()]);
    }
    setSearch("");
    setDebounced("");
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

  const selectedProducts = rows
    .map((row) => {
      const fromList = products.find((p) => String(p.id) === String(row.productId));
      if (fromList) return fromList;
      const fromInitial = (initial?.items || []).find(
        (line) =>
          String(line.product_id || line.product?.id) === String(row.productId)
      );
      return fromInitial?.product || null;
    })
    .filter(Boolean);

  const productOptions = [
    ...selectedProducts.filter(
      (p, i, arr) => arr.findIndex((x) => String(x.id) === String(p.id)) === i
    ),
    ...products.filter(
      (p) => !selectedProducts.some((s) => String(s.id) === String(p.id))
    ),
  ];

  const updateRow = (key, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  const addRow = () => {
    const lastReason = rows[rows.length - 1]?.reason || "WASTE";
    setRows((prev) => [...prev, emptyWriteOffRow(lastReason)]);
  };

  const removeRow = (key) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const findProduct = (productId) => {
    if (!productId) return null;
    return (
      productOptions.find((p) => String(p.id) === String(productId)) ||
      products.find((p) => String(p.id) === String(productId)) ||
      null
    );
  };

  useEffect(() => {
    if (!open || !units.length) return;
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.productId) return row;
        const product = findProduct(row.productId);
        if (!product) return row;
        const allowed = compatibleUnits(units, productUnitName(product));
        const currentOk =
          row.qtyUnitId &&
          allowed.some((u) => String(u.id) === String(row.qtyUnitId));
        if (currentOk) return row;
        const nextId = defaultQtyUnitId(product, units);
        if (!nextId || nextId === row.qtyUnitId) return row;
        changed = true;
        return { ...row, qtyUnitId: nextId };
      });
      return changed ? next : prev;
    });
  }, [open, units, products]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.productId) {
        toast.error(`Baris ${i + 1}: pilih produk`);
        return;
      }
      const n = Number(row.qty);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error(`Baris ${i + 1}: qty harus > 0`);
        return;
      }
      if (!row.qtyUnitId) {
        toast.error(`Baris ${i + 1}: pilih satuan (Unit)`);
        return;
      }
      items.push({
        ...(row.id ? { id: row.id } : {}),
        product_id: Number(row.productId),
        qty: n,
        qty_unit_id: Number(row.qtyUnitId),
        reason: row.reason,
        note: String(row.note || "").trim() || undefined,
      });
    }
    onSubmit(items);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl border max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              {isEdit ? "Edit Draft Write-off" : "Catat Write-off (Draft)"}
            </h3>
            <p className="text-xs text-gray-500">
              Semua baris tersimpan jadi satu catatan draft — stok belum
              berkurang sampai di-Submit.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
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

          {rows.map((row, idx) => {
            const selected = productOptions.find(
              (p) => String(p.id) === String(row.productId)
            );
            const stockUnitName = productUnitName(selected);
            const qtyUnits = unitsForProduct(units, selected);
            return (
              <div
                key={row.key}
                className="rounded-lg border border-gray-200 p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-600">
                    Baris {idx + 1}
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Hapus baris"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produk
                  </label>
                  <select
                    value={row.productId}
                    onChange={(e) => {
                      const productId = e.target.value;
                      const product = productOptions.find(
                        (p) => String(p.id) === String(productId)
                      );
                      updateRow(row.key, {
                        productId,
                        qtyUnitId: product
                          ? defaultQtyUnitId(product, units)
                          : "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">
                      {productsQ.isFetching
                        ? "Memuat produk..."
                        : "-- Pilih Produk --"}
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
                      {stockUnitName ? ` ${formatUnitLabel(stockUnitName)}` : ""}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_6.5rem_1fr] gap-3">
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
                      value={row.qty}
                      onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={
                        qtyUnits.some(
                          (u) => String(u.id) === String(row.qtyUnitId)
                        )
                          ? String(row.qtyUnitId)
                          : ""
                      }
                      onChange={(e) =>
                        updateRow(row.key, { qtyUnitId: e.target.value })
                      }
                      disabled={!row.productId}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                    >
                      {!row.productId && <option value="">—</option>}
                      {qtyUnits.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {formatUnitLabel(u.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alasan
                    </label>
                    <select
                      value={row.reason}
                      onChange={(e) =>
                        updateRow(row.key, { reason: e.target.value })
                      }
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
                <input
                  value={row.note}
                  onChange={(e) => updateRow(row.key, { note: e.target.value })}
                  placeholder="Catatan (opsional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" />
            Tambah baris
          </button>

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
                  : `Simpan Draft (${rows.length} produk)`}
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
    queryFn: ({ signal }) => listWriteOffBatches(params, signal),
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

  const saveM = useMutation({
    mutationFn: async (items) => {
      if (editTarget?.batch_uid) {
        await updateWriteOffBatch(editTarget.batch_uid, { items });
      } else {
        await createWriteOffBatch({
          store_location_id: effectiveStoreId,
          items,
        });
      }
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(
        `Draft tersimpan (${n} produk) — stok belum berkurang. Submit bila sudah benar.`
      );
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

  const submitM = useMutation({
    mutationFn: (batchUid) => submitWriteOffBatch(batchUid),
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
    mutationFn: (batchUid) => deleteWriteOffBatch(batchUid),
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
          const status = r.status || "submitted";
          const style =
            status === "draft"
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : status === "partial"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";
          const label =
            status === "draft"
              ? "Draft"
              : status === "partial"
                ? "Sebagian"
                : "Submitted";
          return (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${style}`}
            >
              {label}
            </span>
          );
        },
      },
      {
        key: "items",
        header: "Produk",
        cell: (r) => (
          <div className="min-w-0 space-y-1">
            {(r.items || []).map((line) => {
              const uom = writeOffUnitLabel(line);
              return (
                <div key={line.id} className="flex items-start gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {line.product?.name || `#${line.product_id}`}
                  </span>
                  <span
                    className={`inline-flex shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                      REASON_STYLE[line.reason] || REASON_STYLE.OTHER
                    }`}
                  >
                    {REASONS.find((x) => x.value === line.reason)?.label ||
                      line.reason}
                  </span>
                  <span className="shrink-0 text-gray-700">
                    {Number(line.qty).toLocaleString("id-ID", {
                      maximumFractionDigits: 4,
                    })}
                    {uom ? ` ${formatUnitLabel(uom)}` : ""}
                  </span>
                  {line.note && (
                    <span className="text-xs text-gray-500 truncate">
                      {line.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ),
      },
      {
        key: "items_count",
        header: "Baris",
        align: "right",
        width: "80px",
        cell: (r) => r.items_count ?? (r.items || []).length,
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
        key: "actions",
        header: "Aksi",
        width: "180px",
        cell: (r) => {
          const draft = (r.status || "submitted") === "draft";
          if (!draft) {
            return <span className="text-xs text-gray-400">Terkunci</span>;
          }
          const busy =
            submitM.isPending || saveM.isPending || deleteM.isPending;
          const lines = r.items_count ?? (r.items || []).length;
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
                      `Submit write-off ini (${lines} produk)? Stok akan berkurang.`
                    )
                  ) {
                    submitM.mutate(r.batch_uid);
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
                    deleteM.mutate(r.batch_uid);
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
    [submitM.isPending, saveM.isPending, deleteM.isPending]
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
              getRowKey={(row) => row.batch_uid}
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
        saving={saveM.isPending}
        onSubmit={(items) => saveM.mutate(items)}
      />
    </div>
  );
}
