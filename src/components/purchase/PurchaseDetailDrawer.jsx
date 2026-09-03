// =============================
// src/components/purchase/PurchaseDetailDrawer.jsx
// (POPUP modal) — Download PO (PDF) + supplier + me/store-location fallback
// =============================
import React, { useEffect, useMemo, useState } from "react";
import { X, Calendar, Download, History, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getPurchase, updatePurchase, cancelPurchaseItem } from "../../api/purchases";
import { getSupplier } from "../../api/suppliers";
import { getStoreLocation } from "../../api/storeLocations";
import { getMe } from "../../api/users";              // ⬅️ ambil profil user aktif

import { exportPurchasePdf } from "../../lib/exportPurchasePdf";
import { IDR } from "../../lib/fmt";
import Pill from "./Pill";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Format date-only fields (avoid UTC midnight showing as previous/next day with time). */
const formatDate = (s) => {
  if (!s) return "-";
  const raw = String(s);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function remainOfItem(it) {
  const cancelled = ["cancelled", "canceled"].includes(
    String(it?.status || "").toLowerCase()
  );
  if (cancelled) return 0;
  const r = Number(it?.qty_remaining);
  if (Number.isFinite(r)) return Math.max(0, r);
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
  onOpenHistory,
  canManage = false,
}) {
  const qc = useQueryClient();

  // 1) Purchase
  const { data: purchase, isLoading, isError, error, refetch } = useQuery({
    enabled: !!open && purchaseId != null && purchaseId !== "",
    queryKey: ["purchase", purchaseId],
    queryFn: ({ queryKey, signal }) => getPurchase(queryKey[1], signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 2) Supplier (by id)
  const supplierId = purchase?.supplier_id ?? purchase?.supplier?.id ?? null;
  const { data: supplier, isFetching: supplierLoading } = useQuery({
    enabled: !!open && !!supplierId,
    queryKey: ["supplier", supplierId],
    queryFn: ({ queryKey, signal }) => getSupplier(queryKey[1], signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 3) Me (user aktif) → kalau purchase tidak punya store_location, pakai dari me
  const { data: me } = useQuery({
    enabled: !!open,
    queryKey: ["me"],
    queryFn: ({ signal }) => getMe(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 4) Store Location prioritas:
  //    a) purchase.store_location_id → GET /api/store-locations/:id
  //    b) else me.store_location (sudah ikut di payload /api/me)
  const purchaseStoreLocationId = purchase?.store_location_id ?? null;

  const { data: purchaseStoreLoc, isFetching: storeLoading } = useQuery({
    enabled: !!open && !!purchaseStoreLocationId,
    queryKey: ["store-location", purchaseStoreLocationId],
    queryFn: ({ queryKey, signal }) => getStoreLocation(queryKey[1], signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Terpilih: prefer purchase store; fallback ke me.store_location
  const effectiveStoreLoc =
    purchaseStoreLoc || me?.store_location || null;

  useEffect(() => {
    if (purchase && !purchaseStoreLocationId && !me?.store_location) {
      console.warn("[PO] store location tidak tersedia di purchase maupun /me");
    }
  }, [purchase, purchaseStoreLocationId, me]);

  const approvedOrPartial = canReceivePurchase(purchase);

  // Normalisasi items
  const items = useMemo(() => {
    const arr = Array.isArray(purchase?.items) ? purchase.items : [];
    return arr.map((it) => ({
      key: it.id ?? it.purchase_item_id ?? `${it.product_id}`,
      purchase_item_id: it.purchase_item_id ?? it.id,
      product_id: it.product_id,
      product_label: it.product_label ?? it?.product?.name ?? `#${it.product_id}`,
      name: it.product_label ?? it?.product?.name ?? `#${it.product_id}`,
      unit:
        it.unit_name ||
        it.unit?.name ||
        it?.product?.unit_name ||
        it?.product?.unit?.name ||
        it.uom ||
        (typeof it.unit === "string" ? it.unit : null) ||
        "—",
      qty_order: num(it.qty_order),
      qty_received_so_far: num(it.qty_received_so_far ?? it.qty_received),
      qty_reversed: num(it.qty_reversed),
      qty_remaining: remainOfItem(it),
      unit_price: Number(it.unit_price || 0),
      adjusted_unit_cost:
        it.adjusted_unit_cost == null || it.adjusted_unit_cost === ""
          ? null
          : Number(it.adjusted_unit_cost),
      line_total: Number(it.line_total || num(it.qty_order) * Number(it.unit_price || 0)),
      cogs_delta: Number(it.cogs_delta || 0),
      status: String(it.status || "open").toLowerCase(),
      cancelled: ["cancelled", "canceled"].includes(String(it.status || "").toLowerCase()),
      cancelled_note: it.cancelled_note || it.delete_lock?.message || null,
      delete_lock: it.delete_lock || {},
    }));
  }, [purchase]);

  const [downloading, setDownloading] = useState(false);
  const [priceDraft, setPriceDraft] = useState({});

  const priceEditable = !!purchase?.price_editable;
  const priceLock = purchase?.price_edit_lock;
  const story = purchase?.receipt_story || {};
  const hasStory = !!(story.has_reversed || story.has_cost_adjustment);
  const showReversedCol = items.some((it) => it.qty_reversed > 0);
  const colCount = 8 + (showReversedCol ? 1 : 0) + (canManage ? 1 : 0);

  useEffect(() => {
    if (!purchase?.items) {
      setPriceDraft({});
      return;
    }
    const next = {};
    for (const it of purchase.items) {
      next[it.id ?? it.purchase_item_id] = String(it.unit_price ?? "");
    }
    setPriceDraft(next);
  }, [purchase]);

  const savePricesMut = useMutation({
    mutationFn: (payload) => updatePurchase(purchaseId, payload),
    onSuccess: () => {
      toast.success("Harga PO disimpan");
      qc.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.errors?.unit_price?.[0] ||
          e?.response?.data?.message ||
          "Gagal menyimpan harga PO"
      ),
  });

  const cancelLineMut = useMutation({
    mutationFn: (itemId) => cancelPurchaseItem(purchaseId, itemId),
    onSuccess: (res) => {
      toast.success(res?.message || "Baris PO dibatalkan");
      qc.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["for-receipt"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
    },
    onError: (e) => {
      const data = e?.response?.data;
      toast.error(data?.message || "Baris PO tidak bisa dihapus");
      if (data?.recommended_action && onOpenHistory && purchase) {
        onOpenHistory(purchase);
      }
    },
  });

  function handleCancelLine(it) {
    const lock = it.delete_lock || {};
    if (it.cancelled) return;
    if (lock.deletable === false) {
      toast.error(lock.message || "Baris ini tidak bisa dihapus.");
      if (lock.recommended_action && onOpenHistory && purchase) {
        onOpenHistory(purchase);
      }
      return;
    }
    const ok = window.confirm(
      lock.code === "LINE_UNTOUCHED"
        ? "Batalkan baris ini? Baris PO tetap tercatat (cancelled). GR/layer yang belum terpakai dihapus dan stok kembali 0."
        : "Batalkan baris ini? Baris PO tetap tercatat sebagai cancelled."
    );
    if (!ok) return;
    cancelLineMut.mutate(it.purchase_item_id);
  }

  function handleSavePrices() {
    const rows = items
      .filter((it) => !it.cancelled)
      .map((it) => ({
      id: it.purchase_item_id,
      unit_price: Number(priceDraft[it.purchase_item_id] ?? it.unit_price),
    }));
    if (rows.some((r) => !Number.isFinite(r.unit_price) || r.unit_price < 0)) {
      toast.error("Unit price harus angka ≥ 0");
      return;
    }
    savePricesMut.mutate({ items: rows });
  }

  async function handleDownload() {
    if (!purchase) return;
    setDownloading(true);
    try {
      // Header perusahaan dari effectiveStoreLoc (punyamu: {id, code, name, address, phone})
      const company = {
        name:   effectiveStoreLoc?.name ?? window.APP_COMPANY?.name ?? "PT. BUANA SELARAS GLOBALINDO",
        address: effectiveStoreLoc?.address ?? window.APP_COMPANY?.address ?? "TamanTekno BSD City Sektor XI\nBlok A2 No. 28, Setu, Tangerang Selatan 15314",
        phone:  effectiveStoreLoc?.phone ? `Tel. ${effectiveStoreLoc.phone}` : (window.APP_COMPANY?.phone ?? "Tel. +62 21 7567217/270 (hunting)"),
        fax:    window.APP_COMPANY?.fax ?? "", // APImu tidak punya fax
      };

      await exportPurchasePdf({
        logoUrl: effectiveStoreLoc?.logo_url || effectiveStoreLoc?.brand_logo_url || "/images/LogoBSG.png",
        company,
        po: {
          ...purchase,
          supplier: { ...(purchase?.supplier ?? {}), ...(supplier ?? {}) },
        },
        items,
        metaRight: {
          projectRef: purchase?.project_ref ?? "-",
          purreqNo:   purchase?.purreq_no ?? purchase?.rq_no ?? "-",
          revision:   purchase?.revision ?? "-",
        },
        printedBy: me?.name || "Purchasing",
      });

      toast.success("PO report berhasil diunduh.");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Gagal membuat PO report.");
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center px-4">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold truncate">
                {purchase?.purchase_number || "Purchase"}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                Supplier: {supplier?.name ?? purchase?.supplier?.name ?? (supplierId ? `#${supplierId}` : "-")}
              </p>
            </div>

            <button
              onClick={handleDownload}
              disabled={!purchase || downloading || supplierLoading || storeLoading}
              className={
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border " +
                (downloading || supplierLoading || storeLoading
                  ? "bg-gray-200 text-gray-600 cursor-wait"
                  : "bg-blue-600 text-white border-slate-200 hover:bg-blue-700")
              }
              title="Download PO (PDF)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">
                {downloading ? "Processing..." : "Download"}
              </span>
            </button>

            {purchase && (
              <button
                type="button"
                onClick={() => onOpenHistory?.(purchase)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
                title="Riwayat GR / cost adjustment"
              >
                <History className="w-4 h-4" />
                <span className="hidden md:inline">Riwayat GR</span>
              </button>
            )}

            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="p-5">
              {isLoading && <div className="text-sm text-gray-600">Loading...</div>}

              {isError && (
                <div className="text-sm p-3 rounded bg-red-50 text-red-700">
                  Failed to load detail.
                  <div className="text-xs mt-1">{error?.response?.data?.message || error?.message}</div>
                  <button onClick={() => refetch()} className="mt-2 px-3 py-1 border rounded">Reload</button>
                </div>
              )}

              {purchase && !isLoading && !isError && (
                <>
                  {/* Ringkasan */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Order: {formatDate(purchase.order_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Expected: {formatDate(purchase.expected_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>Status:</span>
                      <Pill
                        variant={
                          String(purchase.status || "").includes("received")
                            ? "success"
                            : String(purchase.status || "").toLowerCase() === "approved"
                            ? "default"
                            : "warn"
                        }
                      >
                        {purchase.status}
                      </Pill>
                      {story.has_reversed && <Pill variant="warn">GR reversed</Pill>}
                      {story.has_cost_adjustment && <Pill variant="default">Cost adjustment</Pill>}
                    </div>
                    <div className="flex items-start gap-2">
                      <span>Total:</span>
                      <span className="font-medium text-right">
                        {Number(purchase.grand_total || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                        {story.has_cost_adjustment && (
                          <div className="text-[11px] font-normal text-slate-500">
                            Total order, bukan COGS
                          </div>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Tabel items */}
                  <div className="border rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-3 text-left whitespace-nowrap">Product</th>
                          <th className="p-3 text-right whitespace-nowrap">Qty Order</th>
                          <th className="p-3 text-left whitespace-nowrap">Satuan</th>
                          <th className="p-3 text-right whitespace-nowrap">Received</th>
                          {showReversedCol && (
                            <th className="p-3 text-right whitespace-nowrap">Reversed</th>
                          )}
                          <th className="p-3 text-right whitespace-nowrap">Remain</th>
                          <th className="p-3 text-right whitespace-nowrap">Harga PO</th>
                          <th className="p-3 text-right whitespace-nowrap">
                            Line Total
                            {story.has_cost_adjustment && (
                              <div className="text-[10px] font-normal text-slate-400">qty order × harga PO</div>
                            )}
                          </th>
                          <th className="p-3 text-center sticky right-0 bg-gray-50 whitespace-nowrap z-10">GR</th>
                          {canManage && (
                            <th className="p-3 text-center whitespace-nowrap">Hapus</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => {
                          const remain = it.cancelled ? 0 : it.qty_remaining;
                          const canGRItem = !it.cancelled && approvedOrPartial && remain > 0;
                          const draftPrice = Number(priceDraft[it.purchase_item_id] ?? it.unit_price);
                          const linePreview = Number.isFinite(draftPrice)
                            ? it.qty_order * draftPrice
                            : it.line_total;
                          const canDelete = canManage && !it.cancelled && it.delete_lock?.deletable === true;
                          const deleteTitle = it.cancelled
                            ? "Baris sudah dibatalkan"
                            : it.delete_lock?.message || "Batalkan baris PO";

                          return (
                            <tr key={it.key} className={"border-t" + (it.cancelled ? " bg-slate-50 text-slate-400" : "")}>
                              <td className="p-3">
                                <div className={it.cancelled ? "line-through" : ""}>{it.product_label}</div>
                                {it.cancelled && (
                                  <div className="text-[11px] text-rose-600 mt-0.5 no-underline">
                                    Dibatalkan
                                    {it.cancelled_note ? ` · ${it.cancelled_note}` : ""}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">{it.qty_order}</td>
                              <td className="p-3 whitespace-nowrap">{it.unit}</td>
                              <td className="p-3 text-right whitespace-nowrap">{it.qty_received_so_far}</td>
                              {showReversedCol && (
                                <td className="p-3 text-right whitespace-nowrap text-amber-800">
                                  {it.qty_reversed > 0 ? it.qty_reversed : "—"}
                                </td>
                              )}
                              <td className="p-3 text-right whitespace-nowrap">{remain}</td>
                              <td className="p-3 text-right whitespace-nowrap">
                                {priceEditable && !it.cancelled ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="w-32 text-right border rounded-lg px-2 py-1"
                                    value={priceDraft[it.purchase_item_id] ?? it.unit_price}
                                    onChange={(e) =>
                                      setPriceDraft((prev) => ({
                                        ...prev,
                                        [it.purchase_item_id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <div>
                                    <div>{it.unit_price.toLocaleString("id-ID")}</div>
                                    {it.adjusted_unit_cost != null &&
                                      Number.isFinite(it.adjusted_unit_cost) &&
                                      Math.abs(it.adjusted_unit_cost - it.unit_price) > 0.000001 && (
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                          Koreksi COGS: {IDR(it.adjusted_unit_cost)}
                                        </div>
                                      )}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <div>{linePreview.toLocaleString("id-ID")}</div>
                                {story.has_cost_adjustment && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                    Total order, tidak diubah
                                    {Math.abs(it.cogs_delta) > 0.000001 && (
                                      <>
                                        <br />
                                        Selisih COGS: {IDR(it.cogs_delta)}
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center sticky right-0 bg-white z-10">
                                <button
                                  disabled={!canGRItem}
                                  onClick={() =>
                                    onReceiveItem?.({
                                      purchaseId: purchase.id ?? purchase.purchase_id,
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
                                    (canGRItem ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-600 cursor-not-allowed")
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
                              {canManage && (
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    disabled={!canDelete || cancelLineMut.isPending}
                                    onClick={() => handleCancelLine(it)}
                                    className={
                                      "inline-flex items-center justify-center p-1.5 rounded-lg border " +
                                      (canDelete
                                        ? "text-rose-600 border-rose-200 hover:bg-rose-50"
                                        : "text-slate-300 border-slate-200 cursor-not-allowed")
                                    }
                                    title={deleteTitle}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {items.length === 0 && (
                          <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={colCount}>
                              Tidak ada item.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {hasStory ? (
                    <div className="mt-3 text-xs p-3 rounded-lg bg-sky-50 text-sky-950 border border-sky-200 space-y-2">
                      <div className="font-medium">{story.headline}</div>
                      <p>{story.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sky-900/80">
                        {story.has_reversed && (
                          <span>
                            Reversed {Number(story.qty_reversed || 0).toLocaleString("id-ID")}
                          </span>
                        )}
                        {story.has_cost_adjustment && (
                          <span>
                            {story.cost_adjustment_count} cost adjustment
                            {Number(story.cogs_delta_total || 0) !== 0
                              ? ` · selisih COGS ${IDR(story.cogs_delta_total)}`
                              : ""}
                          </span>
                        )}
                      </div>
                      {Array.isArray(story.receipts) && story.receipts.length > 0 && (
                        <p className="text-sky-900/80">
                          GR:{" "}
                          {story.receipts
                            .map((gr) => `${gr.gr_number || `#${gr.id}`} (${gr.status})`)
                            .join(", ")}
                        </p>
                      )}
                      {onOpenHistory && (
                        <button
                          type="button"
                          onClick={() => onOpenHistory(purchase)}
                          className="inline-flex items-center gap-1.5 text-sky-800 hover:underline font-medium"
                        >
                          <History className="w-3.5 h-3.5" />
                          Buka Riwayat GR untuk melihat cost adjustment
                        </button>
                      )}
                    </div>
                  ) : priceEditable ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Harga PO masih bisa diubah karena belum ada GR.
                      </p>
                      <button
                        type="button"
                        onClick={handleSavePrices}
                        disabled={savePricesMut.isPending}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savePricesMut.isPending ? "Menyimpan..." : "Simpan harga"}
                      </button>
                    </div>
                  ) : (
                    priceLock?.message && (
                      <div className="mt-3 text-xs p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                        {priceLock.message}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
