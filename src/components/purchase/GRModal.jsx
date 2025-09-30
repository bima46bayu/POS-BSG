// src/components/purchase/GRModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Package, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getForReceipt, createReceipt } from "../../api/purchases";
import toast from "react-hot-toast";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// remain pakai qty_remaining; fallback ke qty_order - qty_received_so_far
function remainOf(row) {
  const r = num(row?.qty_remaining);
  if (r !== null) return Math.max(0, r);

  const order = num(row?.qty_order);
  const receivedSoFar = num(row?.qty_received_so_far);
  if (order !== null && receivedSoFar !== null) {
    const rem = order - receivedSoFar;
    return Math.max(0, Number.isFinite(rem) ? rem : 0);
  }
  return 0;
}

export default function GRModal({ open, onClose, purchaseId }) {
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: open && purchaseId != null && purchaseId !== "",
    queryKey: ["for-receipt", purchaseId],
    queryFn: ({ queryKey, signal }) => getForReceipt(queryKey[1], signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // reset form tiap buka modal
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [headerNotes, setHeaderNotes] = useState("");
  const [qtyMap, setQtyMap] = useState({});
  const [condMap, setCondMap] = useState({});
  useEffect(() => {
    if (open) {
      setReceivedDate(new Date().toISOString().slice(0, 10));
      setHeaderNotes("");
      setQtyMap({});
      setCondMap({});
    }
  }, [open]);

  // bentuk respons yang kamu kirim:
  // { purchase_id, purchase_number, items: [...] }
  const headerPurchaseId = data?.purchase_id ?? purchaseId;
  const headerPurchaseNumber = data?.purchase_number;

  const allRows = useMemo(() => {
    const arr = Array.isArray(data?.items) ? data.items : [];
    return arr;
  }, [data]);

  // tampilkan hanya yang masih ada sisa
  const remainRows = useMemo(() => allRows.filter((r) => remainOf(r) > 0), [allRows]);

  const totalRemain = useMemo(
    () => remainRows.reduce((sum, row) => sum + remainOf(row), 0),
    [remainRows]
  );

  const totalReceiveNow = useMemo(
    () =>
      remainRows.reduce((sum, row, idx) => {
        const key = row.purchase_item_id ?? `${row.product_id}-${idx}`;
        const v = num(qtyMap[key]);
        return sum + (v ?? 0);
      }, 0),
    [qtyMap, remainRows]
  );

  const hasValidInput = useMemo(() => {
    let any = false;
    for (let i = 0; i < remainRows.length; i++) {
      const row = remainRows[i];
      const key = row.purchase_item_id ?? `${row.product_id}-${i}`;
      const remain = remainOf(row);
      const v = num(qtyMap[key]) ?? 0;
      if (v > 0) any = true;
      if (v > remain) return false;
    }
    return any;
  }, [qtyMap, remainRows]);

  const mutation = useMutation({
    mutationFn: (payload) => createReceipt(headerPurchaseId, payload),
    onSuccess: (res) => {
      toast.success(res?.message || "GR posted");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchase", headerPurchaseId] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      onClose?.();
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || "Failed to create GR";
      toast.error(msg);
    },
  });

  const submit = () => {
    for (let i = 0; i < remainRows.length; i++) {
      const row = remainRows[i];
      const key = row.purchase_item_id ?? `${row.product_id}-${i}`;
      const remain = remainOf(row);
      const v = num(qtyMap[key]) ?? 0;
      if (v > remain) {
        return toast.error(`Qty melebihi remain untuk ${row?.product_label ?? "#" + row.product_id}`);
      }
    }

    const items = remainRows
      .map((row, idx) => {
        const key = row.purchase_item_id ?? `${row.product_id}-${idx}`;
        const qty = num(qtyMap[key]) ?? 0;
        if (qty <= 0) return null;
        return {
          purchase_item_id: row.purchase_item_id, // sesuai field backend
          qty_received: qty,
          condition_notes: condMap[key] || "",
        };
      })
      .filter(Boolean);

    if (!items.length) return toast.error("Isi minimal 1 qty received");

    mutation.mutate({
      received_date: receivedDate,
      notes: headerNotes,
      items,
    });
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
              <div className="text-xs text-gray-500">
                Purchase {headerPurchaseNumber ? `#${headerPurchaseNumber}` : `ID: ${headerPurchaseId}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Close GR Modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header form */}
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

        <div className="px-5 pb-2 text-sm text-gray-600">
          Sisa total: <b>{totalRemain}</b> | Terima sekarang: <b>{totalReceiveNow}</b>
        </div>

        <div className="px-5 pb-5">
          {isLoading && <div>Loading remaining items...</div>}

          {isError && (
            <div className="border rounded p-3 text-sm text-red-700 bg-red-50">
              Gagal memuat data GR.
              <div className="mt-1 text-xs text-red-600">
                {error?.response?.data?.message || error?.message || "Unknown error"}
              </div>
              <button
                onClick={() => refetch()}
                className="mt-2 px-3 py-1 rounded border bg-white hover:bg-gray-50"
              >
                Coba lagi
              </button>
            </div>
          )}

          {!isLoading && !isError && remainRows.length === 0 && (
            <div className="border rounded p-4 text-sm text-gray-600 bg-gray-50">
              Tidak ada item tersisa untuk di-GR.
            </div>
          )}

          {remainRows.length > 0 && (
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
                    const key = row.purchase_item_id ?? `${row.product_id}-${idx}`;
                    const remain = remainOf(row);
                    return (
                      <tr key={key} className="border-t">
                        <td className="p-2">{row?.product_label ?? `#${row.product_id}`}</td>
                        <td className="p-2 text-right">{remain}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={remain}
                            value={
                              qtyMap[key] === "" || qtyMap[key] == null
                                ? ""
                                : String(num(qtyMap[key]) ?? "")
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setQtyMap((m) => ({ ...m, [key]: "" }));
                                return;
                              }
                              let v = Number(raw);
                              if (!Number.isFinite(v) || v < 0) v = 0;
                              if (v > remain) v = remain;
                              setQtyMap((m) => ({ ...m, [key]: v }));
                            }}
                            className="w-24 px-2 py-1 border rounded text-right"
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
            disabled={mutation.isLoading || !hasValidInput}
            className={
              "px-4 py-2 text-white rounded disabled:opacity-60 " +
              (totalRemain > 0 ? "bg-green-600 hover:bg-green-700" : "bg-gray-400")
            }
            title={
              remainRows.length === 0
                ? "Tidak ada item tersisa"
                : hasValidInput
                ? "Konfirmasi penerimaan barang"
                : "Isi qty (≤ remain) minimal 1 item"
            }
          >
            {mutation.isLoading ? "Processing..." : "Confirm GR"}
          </button>
        </div>
      </div>
    </div>
  );
}
