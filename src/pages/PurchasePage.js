import React, { useMemo, useState } from "react";
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

  const approveMut = useMutation({ mutationFn: (id) => approvePurchase(id), onSuccess: () => { toast.success("PO approved"); qc.invalidateQueries({ queryKey: ["purchases"] }); } });
  const cancelMut  = useMutation({ mutationFn: (id) => cancelPurchase(id),  onSuccess: () => { toast.success("PO cancelled"); qc.invalidateQueries({ queryKey: ["purchases"] }); } });

  const onDetail  = (row) => { setDrawerPurchaseId(row.id); setDrawerOpen(true); };
  const onGR      = (row) => {
    if (row.status !== "approved") return toast.error("PO belum di-approve. Approve dulu untuk melakukan GR.");
    setGrPurchaseId(row.id); setGrOpen(true);
  };
  const onApprove = (row) => approveMut.mutate(row.id);
  const onCancel  = (row) => cancelMut.mutate(row.id);

  const actions = useMemo(() => ({ onDetail, onGR, onApprove, onCancel }), []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <WizardTabs step={step} onStep={setStep} />
        <FilterBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} filters={filters} setFilters={setFilters}
          onAdd={() => toast("Open Create Draft modal")} onExport={() => toast("Export CSV")} />
      </div>

      {step === 0 ? (
        <PoBySupplierTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          {...actions}
          onSort={(key) => console.log("sort:", key)}
        />
      ) : (
        <PoByItemTable
          search={search}
          filters={filters}
          page={page}
          setPage={setPage}
          onOpenSupplierBreakdown={(row) => { setSupplierData(row); setSupplierDrawerOpen(true); }}
        />
      )}

      {/* Supplier breakdown */}
      <SupplierBreakdownDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        data={supplierData}
        onOpenPo={(poId) => { setSupplierDrawerOpen(false); setDrawerPurchaseId(poId); setDrawerOpen(true); }}
      />

      {/* Detail Drawer - selalu bisa dibuka meski masih draft */}
      <PurchaseDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        purchaseId={drawerPurchaseId}
        onReceiveItem={({ purchaseId }) => { setGrPurchaseId(purchaseId); setGrOpen(true); }}
      />

      {/* GR Modal */}
      <GRModal open={grOpen} onClose={() => setGrOpen(false)} purchaseId={grPurchaseId} />
    </div>
  );
}
