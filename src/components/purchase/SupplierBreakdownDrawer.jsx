import React from "react";
import { X } from "lucide-react";

export default function SupplierBreakdownDrawer({ open, onClose, data, onOpenPo }) {
  if (!open || !data) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{data?.product?.name || `Product #${data?.product_id}`}</h3>
            <p className="text-sm text-gray-500">Supplied by {data?.suppliers?.length || 0} supplier(s)</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {(data?.suppliers || []).map((s, idx) => (
            <div key={s.supplier_id ?? idx} className="border rounded-xl">
              <div className="p-3 font-medium bg-gray-50 flex items-center justify-between">
                <span>{s.name}</span>
                <span className="text-sm text-gray-500">{s.pos.length} PO</span>
              </div>
              <div className="p-3">
                <table className="w-full text-sm">
                  <thead className="text-gray-600">
                    <tr>
                      <th className="p-2 text-left">PO Number</th>
                      <th className="p-2 text-right">Qty Order</th>
                      <th className="p-2 text-right">Qty Received</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.pos.map((po, i) => (
                      <tr key={`${po.id}-${i}`} className="border-t">
                        <td className="p-2">{po.purchase_number}</td>
                        <td className="p-2 text-right">{po.qty_order}</td>
                        <td className="p-2 text-right">{po.qty_received}</td>
                        <td className="p-2 text-center">
                          <button className="text-blue-600 hover:underline" onClick={() => onOpenPo?.(po.id)}>
                            Open PO
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
