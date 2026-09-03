import React, { useEffect, useRef, useState } from 'react';
import { Search, Package, ChevronRight, ArrowLeft, History, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IDR } from '../lib/fmt';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  listPurchases,
  listReceipts,
} from '../api/purchases';
import GRModal from '../components/purchase/GRModal';
import GRHistoryModal from '../components/purchase/GRHistoryModal';
import StoreScopeFilter from '../components/common/StoreScopeFilter';
import { useStoreScopeFilter } from '../hooks/useStoreScopeFilter';
import { getMe } from '../api/users';
import { listStoreLocations } from '../api/storeLocations';
import { hasManagementAccess } from '../utils/roles';

const BRANCH_STORAGE_KEY = 'gr_store_id';
const PARENT_STORAGE_KEY = 'gr_parent_store_id';

const DONE_STATUSES = new Set(['closed', 'completed']);
const SKIP_STATUSES = new Set(['canceled', 'cancelled']);
const OPEN_STATUSES = new Set(['approved', 'partially_received', 'partial']);

const isDone = (status) => DONE_STATUSES.has(String(status || '').toLowerCase());
const isOpenForGr = (status) => OPEN_STATUSES.has(String(status || '').toLowerCase());

function ManualReviewQueue({ enabled, storeLocationId, onOpen }) {
  const { data, isLoading } = useQuery({
    enabled,
    queryKey: ['receipts', 'review-flagged', storeLocationId],
    queryFn: ({ signal }) =>
      listReceipts(
        {
          review_flagged: 1,
          per_page: 50,
          ...(storeLocationId != null ? { store_location_id: storeLocationId } : {}),
        },
        signal
      ),
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const items = data?.data || data?.items || [];

  return (
    <div className="mb-6 bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-amber-700" />
          <h2 className="font-semibold text-amber-950">Manual Review</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-900">
            {isLoading ? '…' : items.length}
          </span>
        </div>
        <p className="text-xs text-amber-800 hidden sm:block">
          GR yang di-flag karena stok sudah terpakai / perlu dicek manual
        </p>
      </div>
      {isLoading && <p className="px-5 py-4 text-sm text-slate-600">Memuat antrian review...</p>}
      {!isLoading && items.length === 0 && (
        <p className="px-5 py-4 text-sm text-slate-600">Tidak ada GR menunggu review di cabang ini.</p>
      )}
      {!isLoading && items.length > 0 && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="p-2.5 text-left">GR</th>
                <th className="p-2.5 text-left">PO</th>
                <th className="p-2.5 text-left">Supplier</th>
                <th className="p-2.5 text-left">Alasan</th>
                <th className="p-2.5 text-left">Di-flag</th>
                <th className="p-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((gr) => (
                <tr key={gr.id} className="border-t">
                  <td className="p-2.5 font-medium whitespace-nowrap">{gr.gr_number || `#${gr.id}`}</td>
                  <td className="p-2.5 whitespace-nowrap">
                    {gr.purchase?.purchase_number || (gr.purchase_id ? `PO #${gr.purchase_id}` : '-')}
                  </td>
                  <td className="p-2.5">{gr.purchase?.supplier?.name || '-'}</td>
                  <td className="p-2.5 max-w-xs truncate" title={gr.review_reason || ''}>
                    {gr.review_reason || '-'}
                  </td>
                  <td className="p-2.5 whitespace-nowrap text-slate-600">
                    {gr.review_flagged_at
                      ? new Date(gr.review_flagged_at).toLocaleString('id-ID')
                      : '-'}
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(gr)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Buka
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GRPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const sp = new URLSearchParams(location.search);
  const initialView = sp.get('view') === 'orders' ? 'orders' : 'suppliers';

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [stores, setStores] = useState([]);

  const [view, setView] = useState(initialView);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [grModalOpen, setGrModalOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [historyPurchase, setHistoryPurchase] = useState(null);
  const [historyReceiptId, setHistoryReceiptId] = useState(null);

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
        if (!cancel) setStores(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancel) setStores([]);
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
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  const purchaseParams = React.useMemo(() => {
    const params = { per_page: 500 };
    if (effectiveStoreId != null) {
      params.store_location_id = effectiveStoreId;
    }
    return params;
  }, [effectiveStoreId]);

  const canLoadPurchases = !meLoading && !needsStoreSelection && effectiveStoreId != null;

  const { data: purchasesData, isLoading, isError, error } = useQuery({
    enabled: canLoadPurchases,
    queryKey: ['purchases', 'gr', purchaseParams],
    queryFn: ({ signal, queryKey }) => listPurchases(queryKey[2], signal),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const prevStoreRef = useRef(undefined);
  useEffect(() => {
    if (prevStoreRef.current === undefined) {
      prevStoreRef.current = effectiveStoreId;
      return;
    }
    if (prevStoreRef.current === effectiveStoreId) return;
    prevStoreRef.current = effectiveStoreId;

    setSelectedSupplier(null);
    setView('suppliers');
    setSearchTerm('');
    setHistoryPurchase(null);
    setHistoryReceiptId(null);
    setGrModalOpen(false);
    if (searchParams.get('view') === 'orders' || searchParams.get('supplier_id')) {
      navigate('/gr', { replace: true });
    }
  }, [effectiveStoreId, navigate, searchParams]);

  const supplierGroups = React.useMemo(() => {
    const list = purchasesData?.data || [];
    if (!Array.isArray(list) || list.length === 0) return [];

    const groups = {};
    for (const purchase of list) {
      const status = String(purchase.status || '').toLowerCase();
      if (SKIP_STATUSES.has(status)) continue;

      if (
        effectiveStoreId != null &&
        purchase.store_location_id != null &&
        Number(purchase.store_location_id) !== Number(effectiveStoreId)
      ) {
        continue;
      }

      const supplierId = purchase.supplier_id ?? purchase.supplier?.id ?? 'unknown';
      const supplierName = purchase.supplier?.name || `Supplier #${supplierId}`;

      if (!groups[supplierId]) {
        groups[supplierId] = {
          id: supplierId,
          name: supplierName,
          code: `SUP${String(supplierId).padStart(3, '0')}`,
          purchases: [],
          pendingPOs: 0,
          donePOs: 0,
          totalAmount: 0,
        };
      }

      groups[supplierId].purchases.push(purchase);
      groups[supplierId].totalAmount += Number(purchase.grand_total || 0);
      if (isDone(status)) groups[supplierId].donePOs += 1;
      else if (isOpenForGr(status) || status === 'draft') groups[supplierId].pendingPOs += 1;
      else groups[supplierId].pendingPOs += 1;
    }

    return Object.values(groups).map((g) => ({
      ...g,
      purchases: [...g.purchases].sort((a, b) => {
        const aDone = isDone(a.status) ? 1 : 0;
        const bDone = isDone(b.status) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return Number(b.id) - Number(a.id);
      }),
      remainingPOs: g.pendingPOs,
    }));
  }, [purchasesData, effectiveStoreId]);

  useEffect(() => {
    const v = searchParams.get('view');
    const sid = searchParams.get('supplier_id');

    if (v === 'orders' && sid && supplierGroups.length) {
      const sup = supplierGroups.find((s) => String(s.id) === String(sid));
      if (sup) {
        setSelectedSupplier(sup);
        setView('orders');
      } else {
        setView('suppliers');
        setSelectedSupplier(null);
        navigate('/gr', { replace: true });
      }
    } else if (v !== 'orders') {
      if (view !== 'suppliers') setView('suppliers');
      if (selectedSupplier) setSelectedSupplier(null);
    }
  }, [supplierGroups, searchParams, navigate]);

  const handleSupplierClick = (supplier) => {
    setSelectedSupplier(supplier);
    setView('orders');
    navigate({ pathname: '/gr', search: `?view=orders&supplier_id=${supplier.id}` });
  };

  const openHistory = (purchase, receiptId = null) => {
    setHistoryReceiptId(receiptId);
    setHistoryPurchase(purchase);
  };

  const handlePOClick = (purchase) => {
    if (isDone(purchase.status)) {
      openHistory(purchase);
      return;
    }
    setSelectedPurchaseId(purchase.id);
    setGrModalOpen(true);
  };

  const handleBack = () => {
    if (view === 'orders') {
      setSelectedSupplier(null);
      setView('suppliers');
      navigate('/gr', { replace: true });
    }
  };

  const handleGRModalClose = () => {
    setGrModalOpen(false);
    setSelectedPurchaseId(null);
  };

  const filteredSuppliers = (supplierGroups || []).filter(
    (s) =>
      (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (s.code || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      draft: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
      partial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Partial GR' },
      partially_received: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Partial GR' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'GR Completed' },
      closed: { bg: 'bg-green-100', text: 'text-green-700', label: 'GR Completed' },
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready to GR' },
      canceled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Canceled' },
    };
    const b = badges[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status || 'Unknown' };
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  if (meLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 md:px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-auto mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {view !== 'suppliers' && (
              <button onClick={handleBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {view === 'suppliers' && 'Goods Receipt - Supplier List'}
                {view === 'orders' && `Purchase Orders - ${selectedSupplier?.name ?? ''}`}
              </h1>
              <p className="text-sm text-slate-600">
                {view === 'suppliers' &&
                  'Pilih supplier untuk melihat PO yang siap di-GR dan riwayat yang sudah selesai'}
                {view === 'orders' &&
                  'PO siap GR di atas; yang sudah selesai bisa dibuka untuk melihat riwayat GR'}
              </p>
              {!canPickStore && (
                <p className="text-xs text-slate-500 mt-1">Cabang: {activeStoreLabel}</p>
              )}
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
          </div>
        </div>

        {needsStoreSelection && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
            Pilih parent store dan branch store untuk melihat Goods Receipt cabang tersebut.
          </div>
        )}

        {!needsStoreSelection && effectiveStoreId == null && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
            Akun ini belum terhubung ke cabang. Hubungi admin untuk assign store.
          </div>
        )}

        {canLoadPurchases && (
          <ManualReviewQueue
            enabled={canLoadPurchases}
            storeLocationId={effectiveStoreId}
            onOpen={(gr) => {
              const purchase = gr.purchase
                ? { id: gr.purchase.id, purchase_number: gr.purchase.purchase_number }
                : { id: gr.purchase_id };
              openHistory(purchase, gr.id);
            }}
          />
        )}

        {canLoadPurchases && isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading purchase orders...</p>
          </div>
        )}

        {canLoadPurchases && isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-semibold mb-2">Error loading data</h3>
            <p className="text-red-600 text-sm">
              {error?.response?.data?.message || error?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {canLoadPurchases && !isLoading && !isError && view === 'suppliers' && (
          <div>
            <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari supplier..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {filteredSuppliers.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">
                  {searchTerm
                    ? 'Tidak ada supplier yang cocok'
                    : `Belum ada purchase order di ${activeStoreLabel}`}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  onClick={() => handleSupplierClick(supplier)}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Package className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {supplier.name}
                        </h3>
                        <p className="text-sm text-slate-500">{supplier.code}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Pending PO:</span>
                      <span className="font-semibold text-slate-900">{supplier.pendingPOs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Selesai (riwayat):</span>
                      <span className="font-semibold text-green-700">{supplier.donePOs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Amount:</span>
                      <span className="font-semibold text-blue-600">{IDR(supplier.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canLoadPurchases && !isLoading && !isError && view === 'orders' && (
          <>
            {selectedSupplier ? (
              <div className="space-y-5">
                {selectedSupplier.purchases.map((po) => {
                  const done = isDone(po.status);
                  return (
                    <div
                      key={po.id}
                      className={`bg-white rounded-xl border overflow-hidden ${
                        done ? 'border-slate-200' : 'border-blue-200'
                      }`}
                    >
                      <div className={`p-6 border-b bg-white ${done ? 'border-slate-200' : 'border-blue-200'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {po.purchase_number || po.id}
                            </h3>
                            <div className="flex gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                              {po.order_date && (
                                <span>Tanggal: {new Date(po.order_date).toLocaleDateString('id-ID')}</span>
                              )}
                              {po.expected_date && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Expected: {new Date(po.expected_date).toLocaleDateString('id-ID')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(po.status)}
                            {Number(po.reversed_gr_count || 0) > 0 && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                GR reversed
                              </span>
                            )}
                            {Number(po.cost_adjustment_count || 0) > 0 && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                Cost adj.
                              </span>
                            )}
                            {!done && (
                              <button
                                onClick={() => handlePOClick(po)}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                Goods Receipt
                              </button>
                            )}
                            <button
                              onClick={() => openHistory(po)}
                              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium inline-flex items-center gap-2 ${
                                done
                                  ? 'bg-slate-800 text-white hover:bg-slate-900'
                                  : 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <History className="w-4 h-4" />
                              Riwayat GR
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-white border-b border-slate-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Total Amount:</span>
                            <p className="font-semibold text-slate-900 mt-1">{IDR(po.grand_total)}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Total Items:</span>
                            <p className="font-semibold text-slate-900 mt-1">{po.items?.length || 0}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Status:</span>
                            <p className="font-semibold text-slate-900 mt-1 capitalize">{po.status}</p>
                          </div>
                          {po.notes && (
                            <div className="md:col-span-1">
                              <span className="text-slate-600">Notes:</span>
                              <p className="text-slate-900 mt-1 truncate">{po.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-600">
                  Supplier tidak ditemukan.{' '}
                  <button className="text-blue-600 underline" onClick={handleBack}>
                    Kembali ke daftar supplier
                  </button>
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <GRModal
        open={grModalOpen}
        onClose={handleGRModalClose}
        purchaseId={selectedPurchaseId}
        onOpenHistory={() => {
          const po = selectedSupplier?.purchases?.find((p) => p.id === selectedPurchaseId)
            || { id: selectedPurchaseId };
          handleGRModalClose();
          openHistory(po);
        }}
      />
      <GRHistoryModal
        open={!!historyPurchase}
        onClose={() => {
          setHistoryPurchase(null);
          setHistoryReceiptId(null);
        }}
        purchase={historyPurchase}
        storeLocationId={effectiveStoreId}
        canManage={hasManagementAccess(me?.role)}
        initialReceiptId={historyReceiptId}
      />
    </div>
  );
}
