import React, { useMemo, useState } from "react";
import { Package, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getForReceipt, createReceipt } from "../../api/purchases";
import toast from "react-hot-toast";

export default function GRModal({ open, onClose, purchaseId }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    enabled: open && !!purchaseId,
    queryKey: ["for-receipt", purchaseId],
    queryFn: () => getForReceipt(purchaseId),
  });

  // header GR
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [headerNotes, setHeaderNotes] = useState("");

  // per-item input
  const [qtyMap, setQtyMap] = useState({});
  const [condMap, setCondMap] = useState({});

  const remainRows = useMemo(() => {
    // sesuaikan dengan bentuk respons for-receipt kamu
    // ideal: [{ id: purchase_item_id, product: {name}, qty_order, qty_received, remain }]
    const rows = data?.items || data?.data || [];
    return rows;
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload) => createReceipt(purchaseId, payload),
    onSuccess: (res) => {
      toast.success(res?.message || "GR posted");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      onClose?.();
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || "Failed to create GR";
      toast.error(msg);
    },
  });

  const submit = () => {
    const items = remainRows
      .map((row, idx) => {
        const key = row.id ?? row.purchase_item_id ?? `${row.product_id}-${idx}`;
        const qty = Number(qtyMap[key] || 0);
        if (qty <= 0) return null;
        return {
          purchase_item_id: row.id ?? row.purchase_item_id,
          qty_received: qty,
          condition_notes: condMap[key] || "",
        };
      })
      .filter(Boolean);

    if (!items.length) return toast.error("Isi minimal 1 qty received");

    const payload = {
      received_date: receivedDate, // "YYYY-MM-DD"
      notes: headerNotes,
      items,
    };

    mutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-3xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-full">
              <Package className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <div className="text-base font-semibold">Goods Receipt</div>
              <div className="text-xs text-gray-500">Purchase ID: {purchaseId}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header fields */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Received Date</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="px-3 py-2 border rounded"
            />
          </div>
          <div className="md:col-span-2 flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Notes</label>
            <input
              value={headerNotes}
              onChange={(e) => setHeaderNotes(e.target.value)}
              placeholder="Batch 1 / catatan umum"
              className="px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="px-5 pb-5">
          {isLoading && <div>Loading remaining items...</div>}
          {isError && <div className="text-red-600">Failed to load for-receipt.</div>}

          {!!remainRows?.length && (
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-right">Remain</th>
                    <th className="p-2 text-right">Receive Now</th>
                    <th className="p-2 text-left">Condition Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {remainRows.map((row, idx) => {
                    const key = row.id ?? row.purchase_item_id ?? `${row.product_id}-${idx}`;
                    const remain =
                      Number(row.remain ?? (row.qty_order - row.qty_received) ?? 0);
                    return (
                      <tr key={key} className="border-t">
                        <td className="p-2">{row?.product?.name ?? `#${row.product_id}`}</td>
                        <td className="p-2 text-right">{remain}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={remain}
                            value={qtyMap[key] ?? ""}
                            onChange={(e) =>
                              setQtyMap((m) => ({ ...m, [key]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={condMap[key] ?? ""}
                            onChange={(e) =>
                              setCondMap((m) => ({ ...m, [key]: e.target.value }))
                            }
                            placeholder="OK / Dus penyok / dst."
                            className="w-full px-2 py-1 border rounded"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={mutation.isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
          >
            {mutation.isLoading ? "Processing..." : "Confirm GR"}
          </button>
        </div>
      </div>
    </div>
  );
}
