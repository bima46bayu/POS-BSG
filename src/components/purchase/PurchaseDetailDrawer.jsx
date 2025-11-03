// =============================
// src/components/purchase/PurchaseDetailDrawer.jsx
// (POPUP modal) — Download PO (PDF) + supplier + me/store-location fallback
// =============================
import React, { useEffect, useMemo, useState } from "react";
import { X, Calendar, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getPurchase } from "../../api/purchases";
import { getSupplier } from "../../api/suppliers";
import { getStoreLocation } from "../../api/storeLocations";
import { getMe } from "../../api/users";              // ⬅️ ambil profil user aktif

import { exportPurchasePdf } from "../../lib/exportPurchasePdf";
import Pill from "./Pill";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function remainOfItem(it) {
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
}) {
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
      unit: it.unit ?? it.uom ?? "Unit",
      qty_order: num(it.qty_order),
      qty_received_so_far: num(it.qty_received_so_far ?? it.qty_received),
      qty_remaining: remainOfItem(it),
      unit_price: Number(it.unit_price || 0),
      line_total: Number(it.line_total || num(it.qty_order) * Number(it.unit_price || 0)),
    }));
  }, [purchase]);

  const [downloading, setDownloading] = useState(false);

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
                      <span>Order: {purchase.order_date ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Expected: {purchase.expected_date ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Total:</span>
                      <span className="font-medium">
                        {Number(purchase.grand_total || 0).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
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
                          <th className="p-3 text-right whitespace-nowrap">Received</th>
                          <th className="p-3 text-right whitespace-nowrap">Remain</th>
                          <th className="p-3 text-right whitespace-nowrap">Unit Price</th>
                          <th className="p-3 text-right whitespace-nowrap">Line Total</th>
                          <th className="p-3 text-center sticky right-0 bg-gray-50 whitespace-nowrap z-10">GR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => {
                          const remain = it.qty_remaining;
                          const canGRItem = approvedOrPartial && remain > 0;

                          return (
                            <tr key={it.key} className="border-t">
                              <td className="p-3">{it.product_label}</td>
                              <td className="p-3 text-right whitespace-nowrap">{it.qty_order}</td>
                              <td className="p-3 text-right whitespace-nowrap">{it.qty_received_so_far}</td>
                              <td className="p-3 text-right whitespace-nowrap">{remain}</td>
                              <td className="p-3 text-right whitespace-nowrap">{it.unit_price.toLocaleString("id-ID")}</td>
                              <td className="p-3 text-right whitespace-nowrap">{it.line_total.toLocaleString("id-ID")}</td>
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
        </div>
      </div>
    </div>
  );
}
