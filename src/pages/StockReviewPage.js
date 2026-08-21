import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { getSales, acknowledgeSaleReview } from "../api/sales";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import StoreScopeFilter from "../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";
import { saleCustomerLabel } from "../utils/customerLabel";

const fmtDateTime = (s) => {
  if (!s) return "—";
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

function shortfallLines(sale) {
  const rows = Array.isArray(sale?.stock_shortfall) ? sale.stock_shortfall : [];
  return rows.map((r) => {
    const name = r.product_name || r.ingredient_name || r.name || `#${r.product_id ?? r.ingredient_id ?? "?"}`;
    const gap = r.shortfall ?? r.qty_sold;
    return `${name}: kurang ${gap}`;
  });
}

export default function StockReviewPage() {
  const qc = useQueryClient();
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);

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
    branchStorageKey: "stock_review_store_id",
    parentStorageKey: "stock_review_parent_store_id",
    me,
    stores,
  });

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    listStoreLocations({ page: 1, per_page: 200 })
      .then((res) => setStores(res?.items || []))
      .catch(() => setStores([]));
  }, [canPickStore]);

  const params = useMemo(
    () => ({
      needs_review: 1,
      without_items: 1,
      per_page: 50,
      ...(effectiveStoreId ? { store_location_id: effectiveStoreId } : {}),
    }),
    [effectiveStoreId]
  );

  const q = useQuery({
    queryKey: ["stock-review", params],
    enabled: !needsStoreSelection,
    queryFn: ({ signal }) => getSales(params, signal),
  });

  const ack = useMutation({
    mutationFn: (id) => acknowledgeSaleReview(id),
    onSuccess: () => {
      toast.success("Ditandai sudah dicek");
      qc.invalidateQueries({ queryKey: ["stock-review"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal menandai"),
  });

  const items = q.data?.items || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Stock Review</h1>
          <p className="text-sm text-gray-500">
            Penjualan offline yang stoknya tidak cukup saat sinkron. Uang sudah masuk;
            cek shortfall lalu tandai sudah dicek.
          </p>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} /> Muat ulang
        </button>
      </div>

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

      {needsStoreSelection ? (
        <p className="text-sm text-gray-500">Pilih cabang dulu.</p>
      ) : q.isLoading ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
          Tidak ada transaksi yang menunggu review.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const gaps = shortfallLines(s);
            return (
              <div
                key={s.id}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-800">
                      <AlertTriangle size={16} className="text-amber-600" />
                      {s.code}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {fmtDateTime(s.created_at)} · {saleCustomerLabel(s)}
                      {s.cashier?.name ? ` · ${s.cashier.name}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={ack.isPending}
                    onClick={() => ack.mutate(s.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check size={14} /> Sudah dicek
                  </button>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {gaps.length === 0 ? (
                    <li>Shortfall tidak tercatat detail.</li>
                  ) : (
                    gaps.map((g) => <li key={g}>{g}</li>)
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
