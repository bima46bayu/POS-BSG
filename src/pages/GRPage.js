import React, { useState } from 'react';
import { Search, Package, ChevronRight, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import { listPurchases } from '../api/purchases';
import GRModal from '../components/purchase/GRModal';

const IDR = (n) =>
  Number(n || 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });

export default function GRPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // initial state dari URL
  const sp = new URLSearchParams(location.search);
  const initialView = sp.get('view') === 'orders' ? 'orders' : 'suppliers';

  const [view, setView] = useState(initialView); // 'suppliers' | 'orders'
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [grModalOpen, setGrModalOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);

  // Ambil purchases (besar per_page agar grouping tidak terpotong)
  const { data: purchasesData, isLoading, isError, error } = useQuery({
    queryKey: ['purchases', { per_page: 500 }],
    queryFn: ({ signal, queryKey }) => {
      const [, params] = queryKey;
      return listPurchases(params, signal);
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Group by supplier, hanya yang belum selesai
  const supplierGroups = React.useMemo(() => {
    const list = purchasesData?.data || [];
    if (!Array.isArray(list) || list.length === 0) return [];

    const groups = {};
    for (const purchase of list) {
      if (['completed', 'closed', 'canceled'].includes(purchase.status)) continue;

      const supplierId = purchase.supplier_id ?? purchase.supplier?.id ?? 'unknown';
      const supplierName = purchase.supplier?.name || `Supplier #${supplierId}`;

      if (!groups[supplierId]) {
        groups[supplierId] = {
          id: supplierId,
          name: supplierName,
          code: `SUP${String(supplierId).padStart(3, '0')}`,
          purchases: [],
          remainingPOs: 0,
          totalAmount: 0,
        };
      }
      groups[supplierId].purchases.push(purchase);
      groups[supplierId].remainingPOs += 1;
      groups[supplierId].totalAmount += Number(purchase.grand_total || 0);
    }
    return Object.values(groups);
  }, [purchasesData]);

  // Sinkronisasi dari URL → state (saat refresh / direct link)
  React.useEffect(() => {
    const v = searchParams.get('view');
    const sid = searchParams.get('supplier_id');

    if (v === 'orders' && sid && supplierGroups.length) {
      const sup = supplierGroups.find((s) => String(s.id) === String(sid));
      if (sup) {
        setSelectedSupplier(sup);
        setView('orders');
      } else {
        // supplier tidak ditemukan → bersihkan URL
        setView('suppliers');
        setSelectedSupplier(null);
        navigate('/gr', { replace: true });
      }
    } else if (v !== 'orders') {
      // URL bukan orders → pastikan state kembali ke suppliers
      if (view !== 'suppliers') setView('suppliers');
      if (selectedSupplier) setSelectedSupplier(null);
    }
  }, [supplierGroups, searchParams, navigate]); 

  const handleSupplierClick = (supplier) => {
    setSelectedSupplier(supplier);
    setView('orders');
    // push URL absolut ke /gr dengan query → browser Back akan kembali ke suppliers
    navigate({ pathname: '/gr', search: `?view=orders&supplier_id=${supplier.id}` });
  };

  const handlePOClick = (purchase) => {
    setSelectedPurchaseId(purchase.id);
    setGrModalOpen(true);
  };

  const handleBack = () => {
    if (view === 'orders') {
      // reset state dulu
      setSelectedSupplier(null);
      setView('suppliers');
      // replace ke /gr (tanpa query) agar tidak menumpuk history "orders"
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
      partial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Partial GR' },
      partially_received: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Partial GR' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'GR Completed' },
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready to GR' },
      closed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Closed' },
      canceled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Canceled' },
    };
    const b = badges[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status || 'Unknown' };
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-auto mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {view !== 'suppliers' && (
              <button onClick={handleBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {view === 'suppliers' && 'Goods Receipt - Supplier List'}
            {view === 'orders' && `Purchase Orders - ${selectedSupplier?.name ?? ''}`}
          </h1>
          <p className="text-sm text-slate-600">
            {view === 'suppliers' && 'Pilih supplier untuk melihat purchase order yang belum di-GR'}
            {view === 'orders' && 'Pilih purchase order untuk melakukan goods receipt'}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading purchase orders...</p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-semibold mb-2">Error loading data</h3>
            <p className="text-red-600 text-sm">
              {error?.response?.data?.message || error?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {/* Supplier List */}
        {!isLoading && !isError && view === 'suppliers' && (
          <div>
            {/* Search */}
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

            {/* Empty */}
            {filteredSuppliers.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">
                  {searchTerm ? 'Tidak ada supplier yang cocok' : 'Tidak ada purchase order yang pending'}
                </p>
              </div>
            )}

            {/* Grid */}
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
                      <span className="font-semibold text-slate-900">{supplier.remainingPOs}</span>
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

        {/* Orders View */}
        {!isLoading && !isError && view === 'orders' && (
          <>
            {selectedSupplier ? (
              <div className="space-y-5">
                {selectedSupplier.purchases.map((po) => (
                  <div key={po.id} className="bg-white rounded-xl border border-blue-200 overflow-hidden">
                    <div className="p-6 border-b border-blue-200 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {po.purchase_number || po.id}
                          </h3>
                          <div className="flex gap-4 mt-2 text-sm text-slate-600">
                            {po.order_date && (
                              <span>Tanggal: {new Date(po.order_date).toLocaleDateString('id-ID')}</span>
                            )}
                            {po.expected_date && (
                              <>
                                <span>•</span>
                                <span>Expected: {new Date(po.expected_date).toLocaleDateString('id-ID')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(po.status)}
                          <button
                            onClick={() => handlePOClick(po)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Goods Receipt
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
                ))}
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

      {/* GR Modal */}
      <GRModal open={grModalOpen} onClose={handleGRModalClose} purchaseId={selectedPurchaseId} />
    </div>
  );
}
