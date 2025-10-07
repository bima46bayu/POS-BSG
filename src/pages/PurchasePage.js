// src/pages/PurchasePage.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import WizardTabs from "../components/purchase/WizardTabs";
import FilterBar from "../components/purchase/FilterBar";

import PoBySupplierTable from "../components/purchase/PoBySupplierTable";
import PoByItemTable from "../components/purchase/PoByItemTable";

import PurchaseDetailDrawer from "../components/purchase/PurchaseDetailDrawer";
import GRModal from "../components/purchase/GRModal";
import AddPurchaseModal from "../components/purchase/AddPurchaseModal";
import SupplierBreakdownDrawer from "../components/purchase/SupplierBreakdownDrawer";

import { approvePurchase, cancelPurchase } from "../api/purchases";

export default function PurchasePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI states
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ===== Drawer states =====
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPurchaseId, setDrawerPurchaseId] = useState(null);

  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [supplierDrawerData, setSupplierDrawerData] = useState(null);

  const [grOpen, setGrOpen] = useState(false);
  const [grPurchaseId, setGrPurchaseId] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [actingId, setActingId] = useState(null);

  // ===== Helper =====
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

  const canGR = useCallback((row) => {
    const status = String(row?.status || "").toLowerCase();
    if (["cancelled", "canceled", "closed", "rejected"].includes(status)) return false;
    const allowed = ["approved", "partially_received"];
    if (!allowed.includes(status)) return false;
    return getRemainCount(row) > 0;
  }, [getRemainCount]);

  // ===== Mutations =====
  const approveMut = useMutation({
    mutationFn: (id) => approvePurchase(id),
    onMutate: (id) => setActingId(id),
    onSuccess: () => {
      toast.success("PO approved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal approve PO"),
    onSettled: () => setActingId(null),
  });

  const cancelMut = useMutation({
    mutationFn: (id) => cancelPurchase(id),
    onMutate: (id) => setActingId(id),
    onSuccess: () => {
      toast.success("PO cancelled");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal cancel PO"),
    onSettled: () => setActingId(null),
  });

  // ===== Actions dipass ke tabel =====
  const onDetail = useCallback((row) => {
    setDrawerPurchaseId(row.id);
    setDrawerOpen(true);
  }, []);

  const onGR = useCallback(
    (row) => {
      if (!canGR(row)) {
        const remain = getRemainCount(row);
        if (remain <= 0) return toast.error("Tidak ada sisa yang bisa di-GR.");
        return toast.error("PO belum memenuhi syarat GR (harus Approved/Partially Received).");
      }
      setGrPurchaseId(row.id);
      setGrOpen(true);
    },
    [canGR, getRemainCount]
  );

  const onApprove = useCallback((row) => approveMut.mutate(row.id), [approveMut]);
  const onCancel = useCallback((row) => cancelMut.mutate(row.id), [cancelMut]);

  const tableActions = useMemo(
    () => ({ onDetailPO: onDetail, onGR, onApprovePO: onApprove, onCancelPO: onCancel, actingId }),
    [onDetail, onGR, onApprove, onCancel, actingId]
  );

  // ======= Supplier Breakdown Handler =======
  const handleOpenSupplierBreakdown = (row) => {
    setSupplierDrawerData(row);
    setSupplierDrawerOpen(true);
  };

  const handleOpenPoFromSupplierDrawer = (id) => {
    setDrawerPurchaseId(id);
    setDrawerOpen(true);
    // penting: tidak menutup supplierDrawer
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500">Kelola purchase order berdasarkan supplier atau item.</p>
        </div>
        <WizardTabs
          step={step}
          onStep={(s) => {
            setStep(s);
            setPage(1);
          }}
        />
      </div>

      {/* FilterBar */}
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
          onAdd={() => setAddOpen(true)}
        />
      </div>

      {/* CONTENT */}
      {step === 0 ? (
        <PoBySupplierTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          {...tableActions}
          canGR={canGR}
          getRemainCount={getRemainCount}
        />
      ) : (
        <PoByItemTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          canGR={canGR}
          getRemainCount={getRemainCount}
          onOpenSupplierBreakdown={handleOpenSupplierBreakdown}
        />
      )}

      {/* Drawer Supplier Breakdown */}
      <SupplierBreakdownDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        data={supplierDrawerData}
        onOpenPo={handleOpenPoFromSupplierDrawer}
      />

      {/* Drawer Purchase Detail */}
      <PurchaseDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        purchaseId={drawerPurchaseId}
        onReceiveItem={({ purchaseId }) => {
          setGrPurchaseId(purchaseId);
          setGrOpen(true);
        }}
      />

      {/* GR Modal */}
      <GRModal open={grOpen} onClose={() => setGrOpen(false)} purchaseId={grPurchaseId} />

      {/* Add Purchase Modal */}
      <AddPurchaseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
