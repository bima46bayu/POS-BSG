// src/pages/PurchasePage.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
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
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";

const STORAGE_KEY = "purchase_store_id";

export default function PurchasePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== user & role =====
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

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

  const isAdmin = useMemo(
    () => String(me?.role || "").toLowerCase() === "admin",
    [me]
  );
  const myStoreId = useMemo(
    () => me?.store_location_id ?? me?.store_location?.id ?? null,
    [me]
  );

  // ===== store list + storeId yang dipilih (disimpan di storage) =====
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  // sync ke localStorage setiap kali storeId berubah
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, storeId || "");
    } catch {
      // abaikan error storage
    }
  }, [storeId]);

  // ambil daftar store (untuk admin dropdown)
  useEffect(() => {
    let cancel = false;
    listStoreLocations({ per_page: 100 })
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

  // default & lock store berdasarkan role
  useEffect(() => {
    if (!myStoreId) return;

    if (!isAdmin) {
      // kasir: selalu pakai store dia, abaikan storage
      setStoreId(String(myStoreId));
      return;
    }

    // admin:
    // - kalau storeId masih kosong (nggak ada di storage / belum pernah pilih) → default ke store dia
    // - kalau sudah ada value → pakai yang lama (termasuk kasus "Semua Store" = "")
    setStoreId((prev) => (prev ? prev : String(myStoreId)));
  }, [myStoreId, isAdmin]);

  const handleChangeStore = useCallback((val) => {
    // kosongkan = semua store (hanya bisa admin)
    setStoreId(val || "");
  }, []);

  // ===== UI states =====
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ===== debounce search biar fetch nggak tiap ketik =====
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

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

  // ===== Mutations =====
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

  // ===== Actions ke tabel =====
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

  // ====== Filters yang benar2 dikirim ke API ======
  const effectiveFilters = useMemo(() => {
    const base = filters || {};
    const out = { ...base };

    // PRIORITAS:
    // - Admin: pakai storeId dari dropdown ('' = semua store → hapus store_location_id)
    // - Non-admin: paksa ke store miliknya
    if (isAdmin) {
      if (storeId) {
        out.store_location_id = String(storeId);
      } else {
        delete out.store_location_id;
      }
    } else if (myStoreId) {
      out.store_location_id = String(myStoreId);
    }

    return out;
  }, [filters, storeId, isAdmin, myStoreId]);

  // ======= Supplier Breakdown =======
  const handleOpenSupplierBreakdown = (row) => {
    setSupplierDrawerData(row);
    setSupplierDrawerOpen(true);
  };

  const handleOpenPoFromSupplierDrawer = (id) => {
    setDrawerPurchaseId(id);
    setDrawerOpen(true);
  };

  // Opsional: jangan render tabel dulu kalau user belum kebaca
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
      {/* Header + Tabs container */}
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
          stores={stores}
          // admin: pakai state storeId (boleh kosong = semua store)
          // non-admin: lock ke myStoreId
          storeId={isAdmin ? storeId : myStoreId ? String(myStoreId) : ""}
          onChangeStore={(val) => {
            if (!isAdmin) return; // guard tambahan (meski di FilterBar juga sudah disable)
            handleChangeStore(val);
            setPage(1);
          }}
          isAdmin={isAdmin}
          onExport={() => toast("Export CSV")}
          onAdd={() => setAddOpen(true)}
        />
      </div>

      {/* CONTENT */}
      {step === 0 ? (
        <PoBySupplierTable
          search={debouncedSearch}
          filters={effectiveFilters}
          page={page}
          setPage={setPage}
          {...tableActions}
          canGR={canGR}
          getRemainCount={getRemainCount}
        />
      ) : (
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
