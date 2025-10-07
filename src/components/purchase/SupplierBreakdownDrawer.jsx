// src/components/purchase/SupplierBreakdownDrawer.jsx
import React from "react";
import { X } from "lucide-react";

// helper angka aman
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function SupplierBreakdownDrawer({ open, onClose, data, onOpenPo }) {
  if (!open || !data) return null;

  const suppliers = Array.isArray(data?.suppliers) ? data.suppliers : [];

  // Penting: semua klik di dalam panel jangan tembus ke backdrop
  const stopAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      {/* panel */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-xl"
        onClick={stopAll}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-full bg-gradient-to-b from-gray-100 to-gray-50 border-l border-gray-200 shadow-inner p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {data?.product?.name || data?.product_label || `Product #${data?.product_id ?? "-"}`}
              </h3>
              <p className="text-sm text-gray-500">
                Supplied by {suppliers.length} supplier(s)
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {suppliers.length === 0 ? (
            <div className="text-sm text-gray-600 border rounded p-3 bg-white shadow-inner">
              Tidak ada supplier untuk produk ini.
            </div>
          ) : (
            <div className="space-y-4">
              {suppliers.map((s, idx) => {
                const pos = Array.isArray(s?.pos) ? s.pos : [];
                return (
                  <div key={s?.supplier_id ?? idx} className="border rounded-xl bg-white overflow-hidden">
                    <div className="p-3 font-medium bg-gray-50 flex items-center justify-between border-b">
                      <span>{s?.name ?? `Supplier #${s?.supplier_id ?? "-"}`}</span>
                      <span className="text-sm text-gray-500">{pos.length} PO</span>
                    </div>

                    <div className="p-3">
                      <table className="w-full text-sm">
                        <thead className="text-gray-700">
                          <tr>
                            <th className="p-2 text-left">PO Number</th>
                            <th className="p-2 text-right">Qty Order</th>
                            <th className="p-2 text-right">Qty Received</th>
                            <th className="p-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pos.map((po, i) => (
                            <tr key={`${po?.id ?? "po"}-${i}`} className="border-t">
                              <td className="p-2">{po?.purchase_number ?? "-"}</td>
                              <td className="p-2 text-right">{num(po?.qty_order)}</td>
                              <td className="p-2 text-right">{num(po?.qty_received)}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-blue-600"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (po?.id) onOpenPo?.(po.id, { keepDrawer: true });
                                  }}
                                  disabled={!po?.id}
                                  title={po?.id ? "Open PO" : "PO tidak valid"}
                                >
                                  Open PO
                                </button>
                              </td>
                            </tr>
                          ))}
                          {pos.length === 0 && (
                            <tr>
                              <td className="p-3 text-center text-gray-500" colSpan={4}>
                                Tidak ada PO untuk supplier ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
