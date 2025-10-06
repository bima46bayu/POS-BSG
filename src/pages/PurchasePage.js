// src/pages/PurchasePage.jsx
import React, { useMemo, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import WizardTabs from "../components/purchase/WizardTabs";
import FilterBar from "../components/purchase/FilterBar";

// Per-PO table (tanpa header/toolbar, aksi sticky right)
import PoBySupplierTable from "../components/purchase/PoBySupplierTable";

// By-Item (punyamu sebelumnya, tetap dipakai di step 1)
import PoByItemTable from "../components/purchase/PoByItemTable";

import PurchaseDetailDrawer from "../components/purchase/PurchaseDetailDrawer";
import GRModal from "../components/purchase/GRModal";
import SupplierBreakdownDrawer from "../components/purchase/SupplierBreakdownDrawer";
import AddPurchaseModal from "../components/purchase/AddPurchaseModal";

// API approve/cancel yang sesuai
import { approvePurchase, cancelPurchase } from "../api/purchases";

export default function PurchasePage() {
  const qc = useQueryClient();

  // 0 = per-PO, 1 = by-item
  const [step, setStep] = useState(0);

  // filter/search/pagination
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPurchaseId, setDrawerPurchaseId] = useState(null);

  // GR modal
  const [grOpen, setGrOpen] = useState(false);
  const [grPurchaseId, setGrPurchaseId] = useState(null);

  // supplier breakdown (dipakai di step by-item)
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [supplierData, setSupplierData] = useState(null);

  // tambah purchase
  const [addOpen, setAddOpen] = useState(false);

  // baris yang sedang diproses approve/cancel → untuk “freeze” tombol + spinner
  const [actingId, setActingId] = useState(null);

  // ===== Helpers: remain & rule GR (tetap dari kode kamu) =====
  const getRemainCount = useCallback((row) => {
    if (!row) return 0;
    if (row.total_remain != null) return Number(row.total_remain);
    if (Array.isArray(row.items)) {
      return row.items.reduce((sum, it) => {
        const order = Number(it.qty_order ?? 0);
        const received = Number(it.qty_received ?? 0);
        return sum + Math.max(0, order - received);
      }, 0);
    }
    if (row.remain != null) return Number(row.remain);
    const order = Number(row.qty_order ?? 0);
    const received = Number(row.qty_received ?? 0);
    return Math.max(0, order - received);
  }, []);

  const canGR = useCallback((row) => {
    const status = String(row?.status || "").toLowerCase();
    if (["cancelled", "canceled"].includes(status)) return false;
    const allowed = ["approved", "partially_received"];
    if (!allowed.includes(status)) return false;
    return getRemainCount(row) > 0;
  }, [getRemainCount]);

  // ===== API mutations (endpoint: /api/purchases/:id/approve & /cancel) =====
  const approveMut = useMutation({
    mutationFn: (id) => approvePurchase(id),
    onSuccess: () => {
      toast.success("PO approved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (err) => {
      toast.error(err?.message || "Gagal approve PO");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id) => cancelPurchase(id),
    onSuccess: () => {
      toast.success("PO cancelled");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (err) => {
      toast.error(err?.message || "Gagal membatalkan PO");
    },
  });

  // ===== Actions (dipass ke tabel) =====
  const onDetail = (row) => {
    setDrawerPurchaseId(row.id);
    setDrawerOpen(true);
  };

  const onGR = (row) => {
    if (!canGR(row)) {
      const remain = getRemainCount(row);
      if (remain <= 0) return toast.error("Tidak ada sisa yang bisa di-GR.");
      return toast.error("PO belum memenuhi syarat GR (harus Approved/Partially Received).");
    }
    setGrPurchaseId(row.id);
    setGrOpen(true);
  };

  const onApprove = (row) => {
    setActingId(row.id);
    approveMut.mutate(row.id, { onSettled: () => setActingId(null) });
  };

  const onCancel = (row) => {
    setActingId(row.id);
    cancelMut.mutate(row.id, { onSettled: () => setActingId(null) });
  };

  const actions = useMemo(() => ({ onDetail, onGR, onApprove, onCancel }), []); 

  // ===== Render =====
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header: Tabs + FilterBar */}
      <div className="flex items-center justify-between mb-6">
        <WizardTabs step={step} onStep={(s) => { setStep(s); setPage(1); }} />
        <FilterBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          filters={filters}
          setFilters={setFilters}
          onAdd={() => setAddOpen(true)}
          onExport={() => toast("Export CSV")}
        />
      </div>

      {/* Content */}
      {step === 0 ? (
        // ======= PER-PO VIEW =======
        <PoBySupplierTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          onApprovePO={actions.onApprove}
          onCancelPO={actions.onCancel}
          onDetailPO={actions.onDetail}     // buka PurchaseDetailDrawer
          actingId={actingId}               // freeze baris saat proses
          fetchDetail={true}                // hitung total/qty jika field total tidak dikirim
        />
      ) : (
        // ======= BY ITEM VIEW (tetap) =======
        <PoByItemTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          onOpenSupplierBreakdown={(row) => {
            setSupplierData(row);
            setSupplierDrawerOpen(true);
          }}
          canGR={canGR}
          getRemainCount={getRemainCount}
        />
      )}

      {/* Supplier breakdown (dipakai di step by-item) */}
      <SupplierBreakdownDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        data={supplierData}
        onOpenPo={(poId) => {
          setSupplierDrawerOpen(false);
          setDrawerPurchaseId(poId);
          setDrawerOpen(true);
        }}
      />

      {/* Detail Drawer */}
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
      <GRModal
        open={grOpen}
        onClose={() => setGrOpen(false)}
        purchaseId={grPurchaseId}
      />

      {/* Add Purchase Modal */}
      <AddPurchaseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
