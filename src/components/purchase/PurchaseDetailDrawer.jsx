// =============================
// src/components/purchase/PurchaseDetailDrawer.jsx
// =============================
import React, { useMemo } from "react";
import { X, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPurchase } from "../../api/purchases";
import Pill from "./Pill";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function remainOfItem(it) {
  // utama: qty_remaining
  const r = Number(it?.qty_remaining);
  if (Number.isFinite(r)) return Math.max(0, r);
  // fallback: order - received_so_far
  const order = num(it?.qty_order);
  const rec = num(it?.qty_received_so_far ?? it?.qty_received);
  return Math.max(0, order - rec);
}

function canReceivePurchase(purchase) {
  const s = String(purchase?.status || "").toLowerCase();
  return s === "approved" || s === "partially_received";
}

export default function PurchaseDetailDrawer({
  open,
  onClose,
  purchaseId,
  onReceiveItem,
}) {
  // Hooks selalu dipanggil, jangan early-return sebelum ini
  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: open && purchaseId != null && purchaseId !== "",
    queryKey: ["purchase", purchaseId],
    queryFn: ({ queryKey, signal }) => getPurchase(queryKey[1], signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const approvedOrPartial = canReceivePurchase(data);

  const items = useMemo(() => {
    const arr = Array.isArray(data?.items) ? data.items : [];
    return arr.map((it) => ({
      key: it.id ?? it.purchase_item_id ?? `${it.product_id}`,
      purchase_item_id: it.purchase_item_id ?? it.id,
      product_id: it.product_id,
      product_label: it.product_label ?? it?.product?.name ?? `#${it.product_id}`,
      qty_order: num(it.qty_order),
      qty_received_so_far: num(it.qty_received_so_far ?? it.qty_received),
      qty_remaining: remainOfItem(it),
      unit_price: Number(it.unit_price || 0),
      line_total: Number(
        it.line_total || (num(it.qty_order) * Number(it.unit_price || 0))
      ),
    }));
  }, [data]);

  // ✅ Kondisikan UI saat return; hooks di atas selalu terpanggil konsisten
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Drawer panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {data?.purchase_number || "Purchase"}
            </h3>
            <p className="text-sm text-gray-500">
              Supplier: {data?.supplier?.name ?? "-"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && <div>Loading...</div>}

        {isError && (
          <div className="text-sm p-3 rounded bg-red-50 text-red-700">
            Failed to load detail.
            <div className="text-xs mt-1">
              {error?.response?.data?.message || error?.message}
            </div>
            <button
              onClick={() => refetch()}
              className="mt-2 px-3 py-1 border rounded"
            >
              Reload
            </button>
          </div>
        )}

        {data && !isLoading && !isError && (
          <>
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Order: {data.order_date ?? "-"}</span>
              </div>
              <div>Expected: {data.expected_date ?? "-"}</div>
              <div>
                Status:{" "}
                <Pill
                  variant={
                    String(data.status || "").includes("received")
                      ? "success"
                      : String(data.status || "").toLowerCase() === "approved"
                      ? "default"
                      : "warn"
                  }
                >
                  {data.status}
                </Pill>
              </div>
              <div>
                Total:{" "}
                <span className="font-medium">
                  {Number(data.grand_total || 0).toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            {/* Tabel items - perbaikan agar kolom GR tidak ketutupan */}
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-3 text-left whitespace-nowrap">Product</th>
                    <th className="p-3 text-right whitespace-nowrap">Qty Order</th>
                    <th className="p-3 text-right whitespace-nowrap">Received</th>
                    <th className="p-3 text-right whitespace-nowrap">Remain</th>
                    <th className="p-3 text-right whitespace-nowrap">Unit Price</th>
                    <th className="p-3 text-right whitespace-nowrap">Line Total</th>
                    {/* Sticky header kanan */}
                    <th className="p-3 text-center sticky right-0 bg-gray-50 whitespace-nowrap z-10">
                      GR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const remain = it.qty_remaining;
                    const canGRItem = approvedOrPartial && remain > 0;

                    return (
                      <tr key={it.key} className="border-t">
                        <td className="p-3">{it.product_label}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {it.qty_order}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {it.qty_received_so_far}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {remain}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {it.unit_price.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {it.line_total.toLocaleString("id-ID")}
                        </td>
                        {/* Sticky cell kanan */}
                        <td className="p-3 text-center sticky right-0 bg-white z-10">
                          <button
                            disabled={!canGRItem}
                            onClick={() =>
                              onReceiveItem?.({
                                purchaseId: data.id ?? data.purchase_id,
                                item: {
                                  purchase_item_id: it.purchase_item_id,
                                  product_id: it.product_id,
                                  product_label: it.product_label,
                                  qty_order: it.qty_order,
                                  qty_received_so_far: it.qty_received_so_far,
                                  qty_remaining: remain,
                                  unit_price: it.unit_price,
                                },
                                remain,
                              })
                            }
                            className={
                              "px-3 py-1 rounded transition " +
                              (canGRItem
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-gray-200 text-gray-600 cursor-not-allowed")
                            }
                            title={
                              approvedOrPartial
                                ? remain > 0
                                  ? "Receive this item"
                                  : "Sudah diterima semua"
                                : "Approve PO terlebih dahulu"
                            }
                          >
                            Receive
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td className="p-3 text-center text-gray-500" colSpan={7}>
                        Tidak ada item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
