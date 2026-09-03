import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { IDR } from "../../lib/fmt";
import {
  listReceipts,
  getReceipt,
  voidReceipt,
  costAdjustReceipt,
  flagReceiptReview,
  resolveReceiptReview,
} from "../../api/purchases";

export default function GRHistoryModal({
  open,
  onClose,
  purchase,
  storeLocationId,
  canManage,
  initialReceiptId = null,
}) {
  const purchaseId = purchase?.id;
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: open && purchaseId != null,
    queryKey: [
      "receipts",
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
  const [reason, setReason] = useState("");
  const [newCosts, setNewCosts] = useState({});
  const [busy, setBusy] = useState(false);

  const detailQuery = useQuery({
    enabled: open && selectedId != null,
    queryKey: ["receipt", selectedId],
    queryFn: ({ signal }) => getReceipt(selectedId, signal),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (open) {
      setSelectedId(initialReceiptId ?? null);
      setReason("");
      setNewCosts({});
    }
  }, [open, purchaseId, initialReceiptId]);

  useEffect(() => {
    setReason("");
    setNewCosts({});
  }, [selectedId]);

  if (!open) return null;

  const detail = detailQuery.data;
  const lifecycle = detail?.lifecycle || {};
  const action = lifecycle.action;
  const allowed = lifecycle.allowed_actions || [];

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["receipts"] });
    await qc.invalidateQueries({ queryKey: ["receipt", selectedId] });
    await qc.invalidateQueries({ queryKey: ["purchases"] });
    await qc.invalidateQueries({ queryKey: ["purchase"] });
    await qc.invalidateQueries({ queryKey: ["for-receipt"] });
    await refetch();
    if (selectedId != null) await detailQuery.refetch();
  };

  const onVoid = async () => {
    if (!selectedId) return;
    if (action === "delete" && !window.confirm("Hapus GR ini? Layer belum terpakai dan akan dihapus permanen.")) {
      return;
    }
    if (action === "reverse" && reason.trim().length < 3) {
      toast.error("Alasan wajib diisi untuk reverse sisa stok.");
      return;
    }
    setBusy(true);
    try {
      const res = await voidReceipt(selectedId, action === "reverse" ? { reason: reason.trim() } : {});
      toast.success(res?.message || "GR diproses");
      if (res?.action === "delete") setSelectedId(null);
      await invalidate();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gagal memproses GR");
    } finally {
      setBusy(false);
    }
  };

  const onCostAdjust = async () => {
    if (!selectedId) return;
    if (reason.trim().length < 3) {
      toast.error("Alasan wajib diisi untuk cost adjustment.");
      return;
    }
    const layers = lifecycle.layers || [];
    const lines = [];
    for (const layer of layers) {
      if (Number(layer.qty_consumed || 0) <= 0) continue;
      const raw = newCosts[layer.id];
      if (raw === undefined || String(raw).trim() === "") continue;
      const cost = Number(raw);
      if (!Number.isFinite(cost) || cost < 0) {
        toast.error(`Harga satuan baru tidak valid untuk ${layer.product_name || layer.product_sku || "item"}`);
        return;
      }
      if (Math.abs(cost - Number(layer.adjusted_unit_cost ?? layer.unit_cost ?? 0)) < 0.000001) continue;
      lines.push({ layer_id: layer.id, new_unit_cost: cost });
    }
    if (lines.length === 0) {
      toast.error("Ubah harga satuan baru pada item yang dikoreksi.");
      return;
    }
    setBusy(true);
    try {
      await costAdjustReceipt(selectedId, {
        lines,
        reason: reason.trim(),
      });
      toast.success("Cost adjustment diposting ke periode berjalan");
      setNewCosts({});
      await invalidate();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gagal cost adjustment");
    } finally {
      setBusy(false);
    }
  };

  const onReview = async () => {
    if (!selectedId) return;
    if (reason.trim().length < 3) {
      toast.error("Alasan wajib diisi untuk manual review.");
      return;
    }
    setBusy(true);
    try {
      await flagReceiptReview(selectedId, { reason: reason.trim() });
      toast.success("GR ditandai untuk manual review");
      await invalidate();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gagal flag review");
    } finally {
      setBusy(false);
    }
  };

  const onResolveReview = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await resolveReceiptReview(selectedId);
      toast.success("Flag manual review dilepas");
      await invalidate();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Gagal menyelesaikan review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] my-6 flex flex-col shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Riwayat Goods Receipt</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {purchase?.purchase_number || `PO #${purchaseId}`}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              PO tidak diubah di sini. Reverse mengembalikan sisa stok; Cost Adjustment hanya mencatat selisih COGS untuk qty yang sudah terjual.
            </p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50">
            Tutup
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {isLoading && <p className="text-sm text-slate-600">Memuat riwayat GR...</p>}
          {isError && (
            <p className="text-sm text-red-600">
              {error?.response?.data?.message || error?.message || "Gagal memuat riwayat"}
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
                          ? new Date(gr.received_date).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td className="p-2.5">
                        <span className="capitalize">{gr.status || "-"}</span>
                        {(gr.review_flagged || gr.review_flagged_at) && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            Review
                          </span>
                        )}
                      </td>
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
                  {lifecycle.qty_received != null && (
                    <p className="text-slate-600">
                      Diterima {lifecycle.qty_received} · sisa {lifecycle.qty_remaining} · terpakai {lifecycle.qty_consumed}
                      {lifecycle.qty_reversed > 0 ? ` · reversed ${lifecycle.qty_reversed}` : ""}
                    </p>
                  )}
                  <div className="border rounded overflow-hidden bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-slate-600 border-b">
                        <tr>
                          <th className="p-2 text-left">Produk</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Terpakai</th>
                          {(action === "cost_adjustment" || allowed.includes("cost_adjustment")) && (
                            <>
                              <th className="p-2 text-right">Harga layer</th>
                              <th className="p-2 text-right">Harga terkoreksi</th>
                              <th className="p-2 text-right min-w-[140px]">Harga satuan baru</th>
                            </>
                          )}
                          <th className="p-2 text-left">Kondisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.items || []).map((it) => {
                          const layer = (lifecycle.layers || []).find(
                            (l) => Number(l.goods_receipt_item_id) === Number(it.id)
                          );
                          const consumed = Number(layer?.qty_consumed || 0);
                          const canAdjustItem =
                            (action === "cost_adjustment" || allowed.includes("cost_adjustment"))
                            && consumed > 0;
                          const label = it.purchase_item?.product
                            ? `${it.purchase_item.product.sku || ""} ${it.purchase_item.product.name || ""}`.trim()
                            : `Item #${it.purchase_item_id}`;
                          return (
                            <tr key={it.id} className="border-t">
                              <td className="p-2">{label}</td>
                              <td className="p-2 text-right">{it.qty_received}</td>
                              <td className="p-2 text-right">{layer ? consumed : "-"}</td>
                              {(action === "cost_adjustment" || allowed.includes("cost_adjustment")) && (
                                <>
                                  <td className="p-2 text-right whitespace-nowrap">
                                    {layer ? IDR(layer.unit_cost) : "-"}
                                  </td>
                                  <td className="p-2 text-right whitespace-nowrap">
                                    {layer ? IDR(layer.adjusted_unit_cost ?? layer.unit_cost) : "-"}
                                  </td>
                                  <td className="p-2 text-right">
                                    {canAdjustItem ? (
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full min-w-[120px] border rounded-lg p-1.5 text-sm text-right"
                                        placeholder="Harga baru"
                                        value={
                                          newCosts[layer.id] ??
                                          String(layer.adjusted_unit_cost ?? layer.unit_cost ?? "")
                                        }
                                        onChange={(e) =>
                                          setNewCosts((prev) => ({
                                            ...prev,
                                            [layer.id]: e.target.value,
                                          }))
                                        }
                                      />
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="p-2">{it.condition_notes || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {(lifecycle.cost_adjustments || []).length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border-b">
                        Cost adjustment yang sudah diposting (layer/PO tidak diubah)
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-slate-600 border-b">
                          <tr>
                            <th className="p-2 text-left">Produk</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Dari</th>
                            <th className="p-2 text-right">Menjadi</th>
                            <th className="p-2 text-right">Selisih COGS</th>
                            <th className="p-2 text-left">Alasan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lifecycle.cost_adjustments.map((adj) => (
                            <tr key={adj.id} className="border-t">
                              <td className="p-2">
                                {`${adj.product_sku || ""} ${adj.product_name || ""}`.trim() || `Produk #${adj.product_id}`}
                              </td>
                              <td className="p-2 text-right">{adj.qty_affected}</td>
                              <td className="p-2 text-right whitespace-nowrap">{IDR(adj.old_unit_cost)}</td>
                              <td className="p-2 text-right whitespace-nowrap">{IDR(adj.new_unit_cost)}</td>
                              <td className="p-2 text-right whitespace-nowrap">{IDR(adj.cogs_delta)}</td>
                              <td className="p-2 text-slate-600">{adj.reason || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canManage && action && action !== "none" && (
                    <div className="mt-3 p-3 rounded-lg border bg-white space-y-2">
                      <div className="font-medium text-slate-800">Koreksi FIFO</div>
                      {action === "delete" && (
                        <p className="text-xs text-slate-500">
                          Stok GR ini belum terjual. Koreksi harga: hapus GR, lalu terima ulang dengan harga benar.
                          Cost adjustment hanya muncul setelah sebagian stok sudah terjual.
                        </p>
                      )}
                      {action === "reverse" && (
                        <p className="text-xs text-slate-500">
                          Ada sisa stok. Reverse hanya mengembalikan qty yang belum terpakai. Qty yang sudah terjual ditandai untuk review.
                        </p>
                      )}
                      {(action === "cost_adjustment" || allowed.includes("cost_adjustment")) && (
                        <p className="text-xs text-slate-500">
                          Stok sudah terpakai. Isi harga satuan baru per item. Layer dan harga PO tidak ditimpa — yang tercatat adalah selisih COGS di tabel koreksi. Item yang tidak diubah dilewati.
                        </p>
                      )}

                      {(action === "reverse" || allowed.includes("cost_adjustment") || allowed.includes("manual_review")) && (
                        <textarea
                          className="w-full border rounded-lg p-2 text-sm"
                          rows={2}
                          placeholder="Alasan (wajib untuk reverse / adjustment / review)"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      )}

                      <div className="flex flex-wrap gap-2">
                        {(action === "delete" || action === "reverse") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onVoid}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                          >
                            {action === "delete" ? "Hapus GR" : "Reverse sisa stok"}
                          </button>
                        )}
                        {(action === "cost_adjustment" || allowed.includes("cost_adjustment")) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onCostAdjust}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                          >
                            Post cost adjustment
                          </button>
                        )}
                        {(action === "cost_adjustment" || allowed.includes("manual_review")) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onReview}
                            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50 disabled:opacity-60"
                          >
                            Flag manual review
                          </button>
                        )}
                      </div>
                      {lifecycle.review_flagged && (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-amber-800">
                            Sudah di-flag untuk review{lifecycle.review_reason ? `: ${lifecycle.review_reason}` : "."}
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onResolveReview}
                            className="shrink-0 px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50 disabled:opacity-60"
                          >
                            Selesai review
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
