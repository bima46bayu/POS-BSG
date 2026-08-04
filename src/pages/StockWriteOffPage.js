// src/pages/StockWriteOffPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash, X } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../components/data-table/DataTable";
import StoreScopeFilter from "../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { getProducts } from "../api/products";
import {
  createWriteOff,
  getWriteOffSummary,
  listWriteOffs,
} from "../api/stockWriteOffs";

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

const IDR = (v) =>
  Number(v || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

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

function WriteOffModal({ open, onClose, storeId, onSubmit, saving }) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("WASTE");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) return;
    setProductId("");
    setQty("");
    setReason("WASTE");
    setNote("");
    setSearch("");
    setDebounced("");
  }, [open]);

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

  const products = productsQ.data?.items || [];
  const selected = products.find((p) => String(p.id) === String(productId));

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!productId) return toast.error("Pilih produk dulu");
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Qty harus > 0");
    onSubmit({
      store_location_id: storeId,
      product_id: Number(productId),
      qty: n,
      reason,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Catat Write-off</h3>
            <p className="text-xs text-gray-500">
              Stok berkurang nyata (FIFO layer).
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
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">
                {productsQ.isFetching ? "Memuat produk..." : "-- Pilih Produk --"}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-gray-500 mt-1">
                Stok saat ini: <b>{selected.stock ?? "-"}</b>
                {selected.unit_name ? ` ${selected.unit_name}` : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
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
              {saving ? "Menyimpan..." : "Simpan Write-off"}
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

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
  }, [effectiveStoreId, reason, from, to, debouncedSearch]);

  const params = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      ...(effectiveStoreId != null
        ? { store_location_id: effectiveStoreId }
        : {}),
      ...(reason ? { reason } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, effectiveStoreId, reason, from, to, debouncedSearch]
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

  const createM = useMutation({
    mutationFn: (payload) => createWriteOff(payload),
    onSuccess: () => {
      toast.success("Write-off tercatat, stok berkurang");
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["write-offs"] });
      qc.invalidateQueries({ queryKey: ["write-offs-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
    },
    onError: (e) => {
      const res = e?.response?.data;
      const msg =
        res?.errors?.qty?.[0] || res?.message || "Gagal menyimpan write-off";
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
        width: "90px",
        cell: (r) => (
          <span className="font-medium">
            {r.qty}
            {r.product?.unit?.name ? ` ${r.product.unit.name}` : ""}
          </span>
        ),
      },
      {
        key: "total_cost",
        header: "Nilai (COGS)",
        align: "right",
        width: "140px",
        cell: (r) => IDR(r.total_cost),
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
    ],
    []
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
            Catat barang waste, spoiled, atau expired. Stok berkurang nyata
            lewat FIFO layer.
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
            onClick={() => setModalOpen(true)}
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
                  {row.qty}
                </div>
                <div className="text-xs text-gray-500">{IDR(row.cost)}</div>
              </div>
            ))}
            <div className="bg-slate-900 text-white rounded-lg p-3">
              <div className="text-xs text-slate-300">Total</div>
              <div className="text-lg font-semibold">
                {summary?.total_qty ?? 0}
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

              {(reason || from || to || search) && (
                <button
                  onClick={() => {
                    setReason("");
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
        onClose={() => setModalOpen(false)}
        storeId={effectiveStoreId}
        saving={createM.isPending}
        onSubmit={(payload) => createM.mutate(payload)}
      />
    </div>
  );
}
