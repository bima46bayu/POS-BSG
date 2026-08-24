import React, { useEffect, useRef, useState } from 'react';
import { Search, Package, ChevronRight, ArrowLeft, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IDR } from '../lib/fmt';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import { listPurchases, listReceipts, getReceipt } from '../api/purchases';
import GRModal from '../components/purchase/GRModal';
import StoreScopeFilter from '../components/common/StoreScopeFilter';
import { useStoreScopeFilter } from '../hooks/useStoreScopeFilter';
import { getMe } from '../api/users';
import { listStoreLocations } from '../api/storeLocations';

const BRANCH_STORAGE_KEY = 'gr_store_id';
const PARENT_STORAGE_KEY = 'gr_parent_store_id';

const DONE_STATUSES = new Set(['closed', 'completed']);
const SKIP_STATUSES = new Set(['canceled', 'cancelled']);
const OPEN_STATUSES = new Set(['approved', 'partially_received', 'partial']);

const isDone = (status) => DONE_STATUSES.has(String(status || '').toLowerCase());
const isOpenForGr = (status) => OPEN_STATUSES.has(String(status || '').toLowerCase());

function GRHistoryModal({ open, onClose, purchase, storeLocationId }) {
  const purchaseId = purchase?.id;

  const { data, isLoading, isError, error } = useQuery({
    enabled: open && purchaseId != null,
    queryKey: [
      'receipts',
      {
        purchase_id: purchaseId,
        per_page: 50,
        ...(storeLocationId != null ? { store_location_id: storeLocationId } : {}),
      },
    ],
    queryFn: ({ signal, queryKey }) => listReceipts(queryKey[1], signal),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const receipts = data?.data || data?.items || [];
  const [selectedId, setSelectedId] = useState(null);

  const detailQuery = useQuery({
    enabled: open && selectedId != null,
    queryKey: ['receipt', selectedId],
    queryFn: ({ signal }) => getReceipt(selectedId, signal),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (open) setSelectedId(null);
  }, [open, purchaseId]);

  if (!open) return null;

  const detail = detailQuery.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] my-6 flex flex-col shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Riwayat Goods Receipt</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {purchase?.purchase_number || `PO #${purchaseId}`}
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50">
            Tutup
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {isLoading && <p className="text-sm text-slate-600">Memuat riwayat GR...</p>}
          {isError && (
            <p className="text-sm text-red-600">
              {error?.response?.data?.message || error?.message || 'Gagal memuat riwayat'}
            </p>
          )}
          {!isLoading && !isError && receipts.length === 0 && (
            <p className="text-sm text-slate-600">Belum ada dokumen GR untuk PO ini.</p>
          )}

          {receipts.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2.5 text-left">GR Number</th>
                    <th className="p-2.5 text-left">Tanggal</th>
                    <th className="p-2.5 text-left">Status</th>
                    <th className="p-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((gr) => (
                    <tr key={gr.id} className="border-t">
                      <td className="p-2.5 font-medium">{gr.gr_number || `#${gr.id}`}</td>
                      <td className="p-2.5">
                        {gr.received_date
                          ? new Date(gr.received_date).toLocaleDateString('id-ID')
                          : '-'}
                      </td>
                      <td className="p-2.5 capitalize">{gr.status || '-'}</td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(gr.id)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedId != null && (
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">
                  Detail {detail?.gr_number || `GR #${selectedId}`}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Sembunyikan
                </button>
              </div>
              {detailQuery.isLoading && <p className="text-sm text-slate-600">Memuat detail...</p>}
              {detailQuery.isError && (
                <p className="text-sm text-red-600">Gagal memuat detail GR.</p>
              )}
              {detail && (
                <div className="space-y-2 text-sm">
                  {detail.notes && (
                    <p className="text-slate-600">
                      Notes: <span className="text-slate-900">{detail.notes}</span>
                    </p>
                  )}
                  <div className="border rounded overflow-hidden bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-slate-600 border-b">
                        <tr>
                          <th className="p-2 text-left">Produk</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-left">Kondisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.items || []).map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="p-2">
                              {it.purchase_item?.product
                                ? `${it.purchase_item.product.sku || ''} ${it.purchase_item.product.name || ''}`.trim()
                                : `Item #${it.purchase_item_id}`}
                            </td>
                            <td className="p-2 text-right">{it.qty_received}</td>
                            <td className="p-2">{it.condition_notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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

  const handlePOClick = (purchase) => {
    if (isDone(purchase.status)) {
      setHistoryPurchase(purchase);
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
                            <button
                              onClick={() => handlePOClick(po)}
                              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium inline-flex items-center gap-2 ${
                                done
                                  ? 'bg-slate-800 text-white hover:bg-slate-900'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {done ? (
                                <>
                                  <History className="w-4 h-4" />
                                  Lihat Riwayat GR
                                </>
                              ) : (
                                'Goods Receipt'
                              )}
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

      <GRModal open={grModalOpen} onClose={handleGRModalClose} purchaseId={selectedPurchaseId} />
      <GRHistoryModal
        open={!!historyPurchase}
        onClose={() => setHistoryPurchase(null)}
        purchase={historyPurchase}
        storeLocationId={effectiveStoreId}
      />
    </div>
  );
}
