import React, { useMemo, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import WizardTabs from "../components/purchase/WizardTabs";
import FilterBar from "../components/purchase/FilterBar";
import PoBySupplierTable from "../components/purchase/PoBySupplierTable";
import PoByItemTable from "../components/purchase/PoByItemTable";
import PurchaseDetailDrawer from "../components/purchase/PurchaseDetailDrawer";
import GRModal from "../components/purchase/GRModal";
import SupplierBreakdownDrawer from "../components/purchase/SupplierBreakdownDrawer";
import { approvePurchase, cancelPurchase } from "../api/purchases";
import AddPurchaseModal from "../components/purchase/AddPurchaseModal";

export default function PurchasePage() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0); // 0 = supplier, 1 = item
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPurchaseId, setDrawerPurchaseId] = useState(null);

  const [grOpen, setGrOpen] = useState(false);
  const [grPurchaseId, setGrPurchaseId] = useState(null);

  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [supplierData, setSupplierData] = useState(null);

  // ===== Helpers: remain & rule GR =====
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
    // IZINKAN GR di approved ATAU partially_received
    const allowed = ["approved", "partially_received"];
    if (!allowed.includes(status)) return false;
    return getRemainCount(row) > 0;
  }, [getRemainCount]);

  const approveMut = useMutation({
    mutationFn: (id) => approvePurchase(id),
    onSuccess: () => {
      toast.success("PO approved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id) => cancelPurchase(id),
    onSuccess: () => {
      toast.success("PO cancelled");
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });

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

  const onApprove = (row) => approveMut.mutate(row.id);
  const onCancel = (row) => cancelMut.mutate(row.id);

  const actions = useMemo(() => ({ onDetail, onGR, onApprove, onCancel }), []); // eslint-disable-line

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <WizardTabs step={step} onStep={setStep} />
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

      {step === 0 ? (
        <PoBySupplierTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          {...actions}
          // tombol GR di list = HIJAU jika masih ada sisa (remain>0) pada status yang diizinkan
          canGR={canGR}
          getRemainCount={getRemainCount}
          onSort={(key) => console.log("sort:", key)}
        />
      ) : (
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

      {/* Supplier breakdown */}
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
