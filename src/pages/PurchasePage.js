// src/pages/PurchasePage.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import WizardTabs from "../components/purchase/WizardTabs";
import FilterBar from "../components/purchase/FilterBar";

import PoBySupplierTable from "../components/purchase/PoBySupplierTable";
import PoByItemTable from "../components/purchase/PoByItemTable";

import PurchaseDetailDrawer from "../components/purchase/PurchaseDetailDrawer";
import GRModal from "../components/purchase/GRModal";
import AddPurchaseModal from "../components/purchase/AddPurchaseModal";
import SupplierBreakdownDrawer from "../components/purchase/SupplierBreakdownDrawer";
import StoreScopeFilter from "../components/common/StoreScopeFilter";

import { approvePurchase, cancelPurchase } from "../api/purchases";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";

const STORAGE_KEY = "purchase_store_id";
const PARENT_STORAGE_KEY = "purchase_parent_store_id";

export default function PurchasePage() {
  const qc = useQueryClient();

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [stores, setStores] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMe();
        if (!cancelled) setMe(res || null);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    listStoreLocations({ per_page: 200 })
      .then(({ items }) => {
        if (cancel) return;
        setStores(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancel) toast.error("Gagal memuat daftar store");
      });
    return () => {
      cancel = true;
    };
  }, []);

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
    branchStorageKey: STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [effectiveStoreId, parentFilterId, storeFilterId]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPurchaseId, setDrawerPurchaseId] = useState(null);

  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [supplierDrawerData, setSupplierDrawerData] = useState(null);

  const [grOpen, setGrOpen] = useState(false);
  const [grPurchaseId, setGrPurchaseId] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [actingId, setActingId] = useState(null);

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const getRemainCount = useCallback((row) => {
    if (!row) return 0;
    if (row.total_remain != null) return Number(row.total_remain);
    if (Array.isArray(row.items)) {
      return row.items.reduce((sum, it) => {
        const order = num(it.qty_order);
        const received = num(it.qty_received);
        return sum + Math.max(0, order - received);
      }, 0);
    }
    if (row.remain != null) return Number(row.remain);
    const order = num(row.qty_order);
    const received = num(row.qty_received);
    return Math.max(0, order - received);
  }, []);

  const canGR = useCallback(
    (row) => {
      const status = String(row?.status || "").toLowerCase();
      if (["cancelled", "canceled", "closed", "rejected"].includes(status))
        return false;
      const allowed = ["approved", "partially_received"];
      if (!allowed.includes(status)) return false;
      return getRemainCount(row) > 0;
    },
    [getRemainCount]
  );

  const approveMut = useMutation({
    mutationFn: (id) => approvePurchase(id),
    onMutate: (id) => setActingId(id),
    onSuccess: () => {
      toast.success("PO approved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal approve PO"),
    onSettled: () => setActingId(null),
  });

  const cancelMut = useMutation({
    mutationFn: (id) => cancelPurchase(id),
    onMutate: (id) => setActingId(id),
    onSuccess: () => {
      toast.success("PO cancelled");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal cancel PO"),
    onSettled: () => setActingId(null),
  });

  const onDetail = useCallback((row) => {
    setDrawerPurchaseId(row.id);
    setDrawerOpen(true);
  }, []);

  const onGR = useCallback(
    (row) => {
      if (!canGR(row)) {
        const remain = getRemainCount(row);
        if (remain <= 0)
          return toast.error("Tidak ada sisa yang bisa di-GR.");
        return toast.error(
          "PO belum memenuhi syarat GR (harus Approved/Partially Received)."
        );
      }
      setGrPurchaseId(row.id);
      setGrOpen(true);
    },
    [canGR, getRemainCount]
  );

  const onApprove = useCallback(
    (row) => approveMut.mutate(row.id),
    [approveMut]
  );
  const onCancel = useCallback(
    (row) => cancelMut.mutate(row.id),
    [cancelMut]
  );

  const tableActions = useMemo(
    () => ({
      onDetailPO: onDetail,
      onGR,
      onApprovePO: onApprove,
      onCancelPO: onCancel,
      actingId,
    }),
    [onDetail, onGR, onApprove, onCancel, actingId]
  );

  const effectiveFilters = useMemo(() => {
    const out = { ...(filters || {}) };
    if (effectiveStoreId != null) {
      out.store_location_id = String(effectiveStoreId);
    } else {
      delete out.store_location_id;
    }
    return out;
  }, [filters, effectiveStoreId]);

  const handleOpenSupplierBreakdown = (row) => {
    setSupplierDrawerData(row);
    setSupplierDrawerOpen(true);
  };

  const handleOpenPoFromSupplierDrawer = (id) => {
    setDrawerPurchaseId(id);
    setDrawerOpen(true);
  };

  const handleAdd = () => {
    if (needsStoreSelection || effectiveStoreId == null) {
      toast.error("Pilih parent store dan cabang dulu");
      return;
    }
    setAddOpen(true);
  };

  if (meLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="h-6 w-40 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Purchases
            </h1>
            <p className="text-sm text-gray-500">
              Kelola purchase order berdasarkan supplier atau item.
            </p>
          </div>

          <WizardTabs
            step={step}
            onStep={(s) => {
              setStep(s);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="mb-6">
        <FilterBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          filters={filters}
          setFilters={setFilters}
          onExport={() => toast("Export CSV")}
          onAdd={handleAdd}
          addDisabled={needsStoreSelection || effectiveStoreId == null}
          storeFilter={
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
          }
        />
      </div>

      {needsStoreSelection && (
        <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Pilih parent store dan branch store untuk melihat / membuat purchase
          order cabang tersebut.
        </div>
      )}

      {!needsStoreSelection && step === 0 && (
        <PoBySupplierTable
          search={debouncedSearch}
          filters={effectiveFilters}
          page={page}
          setPage={setPage}
          {...tableActions}
          canGR={canGR}
          getRemainCount={getRemainCount}
        />
      )}

      {!needsStoreSelection && step === 1 && (
        <PoByItemTable
          search={debouncedSearch}
          filters={effectiveFilters}
          page={page}
          setPage={setPage}
          canGR={canGR}
          getRemainCount={getRemainCount}
          onOpenSupplierBreakdown={handleOpenSupplierBreakdown}
        />
      )}

      <SupplierBreakdownDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        data={supplierDrawerData}
        onOpenPo={handleOpenPoFromSupplierDrawer}
      />

      <PurchaseDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        purchaseId={drawerPurchaseId}
        onReceiveItem={({ purchaseId }) => {
          setGrPurchaseId(purchaseId);
          setGrOpen(true);
        }}
      />

      <GRModal
        open={grOpen}
        onClose={() => setGrOpen(false)}
        purchaseId={grPurchaseId}
      />

      <AddPurchaseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        storeLocationId={effectiveStoreId}
      />
    </div>
  );
}
