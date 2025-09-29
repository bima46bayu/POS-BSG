import React from "react";
import { X, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPurchase } from "../../api/purchases";
import Pill from "./Pill";

export default function PurchaseDetailDrawer({ open, onClose, purchaseId, onReceiveItem }) {
  const { data, isLoading, isError } = useQuery({ enabled: !!purchaseId, queryKey: ["purchase", purchaseId], queryFn: () => getPurchase(purchaseId) });
  if (!open) return null;

  const approved = data?.status === "approved";

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{data?.purchase_number || "Purchase"}</h3>
            <p className="text-sm text-gray-500">Supplier: {data?.supplier?.name ?? "-"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && <div>Loading...</div>}
        {isError && <div className="text-red-600">Failed to load detail.</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>Order: {data.order_date}</span></div>
              <div>Expected: {data.expected_date}</div>
              <div>Status: <Pill variant={data.status?.includes("received") ? "success" : data.status === "approved" ? "default" : "warn"}>{data.status}</Pill></div>
              <div>Total: <span className="font-medium">{Number(data.grand_total || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}</span></div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-right">Qty Order</th>
                    <th className="p-3 text-right">Qty Received</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Line Total</th>
                    <th className="p-3 text-center">GR</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((it) => {
                    const remain = Number(it.qty_order || 0) - Number(it.qty_received || 0);
                    const canGR = approved && remain > 0; // tombol GR nonaktif jika belum approved
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="p-3">{it?.product?.name ?? `#${it.product_id}`}</td>
                        <td className="p-3 text-right">{it.qty_order}</td>
                        <td className="p-3 text-right">{it.qty_received}</td>
                        <td className="p-3 text-right">{Number(it.unit_price || 0).toLocaleString("id-ID")}</td>
                        <td className="p-3 text-right">{Number(it.line_total || 0).toLocaleString("id-ID")}</td>
                        <td className="p-3 text-center">
                          <button
                            disabled={!canGR}
                            onClick={() => onReceiveItem?.({ purchaseId: data.id, item: it, remain })}
                            className={`px-3 py-1 rounded ${canGR ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-300 text-gray-600 cursor-not-allowed"}`}
                            title={approved ? (remain > 0 ? "Receive this item" : "Sudah full received") : "Approve PO terlebih dahulu"}
                          >
                            Receive
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
