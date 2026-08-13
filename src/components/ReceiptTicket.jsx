// src/components/ReceiptTicket.jsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSale } from "../api/sales";
import { getStoreLocation } from "../api/storeLocations";
import { toAbsoluteUrl } from "../api/client";

const toNumber = (v) =>
  v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, ""));
const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

// Ambil store dari berbagai bentuk relasi yang mungkin
const pickStore = (obj) =>
  obj?.storeLocation || obj?.store_location || obj?.store || null;

const storeIdOf = (obj) =>
  obj?.id ??
  obj?.store_location_id ??
  obj?.store_id ??
  obj?.storeLocationId ??
  null;

/**
 * Build URL logo yang aman untuk CORS & html2canvas
 * - Jika logo_url masih model lama `/uploads/storeLogo/...`
 *   → kita mapping ke endpoint API: /api/store-locations/{id}/logo
 * - Jika sudah path/URL lain → langsung pakai toAbsoluteUrl(raw)
 */
const buildStoreLogoUrl = (loc) => {
  if (!loc) return null;

  const raw = (loc.logo_url || "").toString().trim();
  if (!raw) return null;

  // kalau sudah bukan path lama uploads, pakai apa adanya
  if (!raw.includes("/uploads/storeLogo")) {
    return toAbsoluteUrl(raw);
  }

  // mapping path lama → endpoint logo API
  const storeId = storeIdOf(loc);
  if (!storeId) {
    // kalau id nggak ketemu, fallback: tetap pakai raw
    return toAbsoluteUrl(raw);
  }

  // TANPA slash depan → supaya toAbsoluteUrl jadi: {API_BASE}/api/store-locations/{id}/logo
  return toAbsoluteUrl(`api/store-locations/${storeId}/logo`);
};

export default function ReceiptTicket({
  saleId,
  store: storeProp,
  printableId = "receipt-print-area",
}) {
  const {
    data: sale,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: !!saleId,
  });

  // Branding MUST come from the sale's cabang — never from the admin HQ
  // profile (that mixed Instafactory text with Tanabambu logo).
  const saleStore = pickStore(sale);
  const propStore = storeProp || null;
  const cashierStore = pickStore(sale?.cashier);
  const saleStoreId =
    storeIdOf(saleStore) ??
    sale?.store_location_id ??
    sale?.storeLocationId ??
    storeIdOf(propStore) ??
    storeIdOf(cashierStore) ??
    null;

  const needsStoreFetch =
    !!saleStoreId &&
    !(saleStore?.name || propStore?.name || cashierStore?.name);

  const { data: fetchedStore } = useQuery({
    queryKey: ["store-location", saleStoreId],
    queryFn: () => getStoreLocation(saleStoreId),
    enabled: needsStoreFetch,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="p-4 text-sm text-gray-600">Memuat struk…</div>
    );
  if (isError)
    return (
      <div className="p-4 text-sm text-red-600">
        Gagal memuat struk: {String(error?.message || "unknown")}
      </div>
    );

  // prioritas store (penting untuk Admin HQ):
  // 1) cabang transaksi (sale.store_location)
  // 2) prop store
  // 3) cabang kasir di sale
  // 4) fetch by sale.store_location_id
  // NEVER fall back to /me store — that is the admin home brand.
  const loc =
    saleStore || propStore || cashierStore || fetchedStore || null;

  // URL logo yang sudah di-normalisasi untuk endpoint API
  const logoUrl = buildStoreLogoUrl(loc);

  const code = sale?.code || sale?.id;
  const cashier = sale?.cashier?.name || "—";
  const customer = sale?.customer_name || "—";
  const createdAt = sale?.created_at
    ? new Date(sale.created_at)
    : new Date();

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const tax = toNumber(sale?.tax);
  const headerDisc = toNumber(sale?.discount);
  const svc = toNumber(sale?.service_charge);
  const total = toNumber(sale?.total);
  const paid = toNumber(sale?.paid);
  const change = toNumber(sale?.change);
  const payments = Array.isArray(sale?.payments) ? sale.payments : [];

  /*
   | Member & loyalty points.
   | points_earned is snapshotted on the sale by the server, so the printed
   | receipt keeps showing the right number even if the rate changes later.
   */
  const member = sale?.member || null;
  const pointsEarned = toNumber(sale?.points_earned);
  const memberPointBalance =
    member && member.points_balance != null
      ? toNumber(member.points_balance)
      : null;
  // Perubahan: Ambil dari additional_charges_snapshot sesuai response API
  const additionalCharges = Array.isArray(sale?.additional_charges_snapshot)
    ? sale.additional_charges_snapshot
    : [];

  let itemsGross = 0,
    itemDiscountTotal = 0,
    itemsNetSubtotal = 0;

  const renderedItems = items.map((it) => {
    const name =
      it?.product?.name ||
      it?.name ||
      `Item #${it?.id ?? ""}`;
    const qty = toNumber(it?.qty ?? it?.quantity ?? 1);
    const unitPrice = toNumber(it?.unit_price ?? it?.price ?? 0);
    const netUnit = toNumber(it?.net_unit_price ?? 0);
    const discNom = toNumber(
      it?.discount_nominal ??
        (unitPrice && netUnit ? unitPrice - netUnit : 0)
    );
    const lineTotal = toNumber(
      it?.line_total ??
        it?.subtotal ??
        Math.max(0, unitPrice - discNom) * qty
    );

    itemsGross += unitPrice * qty;
    itemDiscountTotal += Math.min(unitPrice, discNom) * qty;
    itemsNetSubtotal += lineTotal;

    // opsi item (sugar level, ice level, dll) — snapshot dari sale_items.options
    let rawOptions = it?.options ?? null;
    if (typeof rawOptions === "string") {
      try {
        rawOptions = JSON.parse(rawOptions);
      } catch {
        rawOptions = null;
      }
    }
    const optionsLabel = Array.isArray(rawOptions)
      ? rawOptions.map((o) => o?.name).filter(Boolean).join(", ")
      : "";

    return {
      id: it.id,
      name,
      qty,
      unitPrice,
      discNom,
      netUnit: netUnit || Math.max(0, unitPrice - discNom),
      lineTotal,
      optionsLabel,
    };
  });

  const grandTotal = Math.max(
    0,
    itemsNetSubtotal - headerDisc + svc + tax
  );

  return (
    <div className="p-0">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 6mm;
          }
          .no-print {
            display: none !important;
          }
        }
        #${printableId} {
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      `}</style>

      <div
        id={printableId}
        className="bg-white text-black mx-auto px-2"
        style={{
          width: 280,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.35,
        }}
      >
        {/* Header toko */}
        <div className="text-center py-1">
          {logoUrl && (
            <div className="flex justify-center mb-2">
              <img
                src={logoUrl}
                alt={loc?.name || "Store Logo"}
                crossOrigin="anonymous"
                style={{
                  maxHeight: 140,
                  maxWidth: 140,
                  objectFit: "contain",
                }}
                onError={() => {
                  console.warn(
                    "Logo gagal dimuat untuk print:",
                    logoUrl
                  );
                }}
              />
            </div>
          )}

          <div className="font-bold uppercase tracking-wide">
            {loc?.name || "BSG Group"}
          </div>
          {loc?.address && (
            <div className="text-[11px] text-gray-700">
              {loc.address}
            </div>
          )}
          {loc?.phone && (
            <div className="text-[11px] text-gray-700">
              Telp: {loc.phone}
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-600 my-2" />

        <Row label="No" value={String(code)} />
        <Row
          label="Tanggal"
          value={createdAt.toLocaleString("id-ID")}
        />
        <Row label="Kasir" value={cashier} />
        <Row label="Customer" value={customer} />

        <div className="border-t border-dashed border-gray-600 my-2" />

        {/* Items */}
        <div className="pb-1">
          {renderedItems.map((it) => (
            <div
              key={
                it.id ??
                `${it.name}-${it.qty}-${it.unitPrice}`
              }
              className="mb-1"
            >
              <div className="whitespace-normal break-words leading-tight">
                {it.name}
              </div>
              {it.optionsLabel && (
                <div className="whitespace-normal break-words leading-tight text-[11px] text-gray-600 pl-2">
                  - {it.optionsLabel}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-700">
                  {it.qty} x {fmtIDR(it.unitPrice)}
                </span>
                <span className="font-medium">
                  {fmtIDR(it.lineTotal)}
                </span>
              </div>
              {it.discNom > 0 && (
                <div className="flex justify-between text-[11px] text-gray-600">
                  <span>
                    Disc/u {fmtIDR(it.discNom)} → Net/u{" "}
                    {fmtIDR(it.netUnit)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-600 my-2" />

        {/* Ringkasan harga */}
        <Row
          label="Subtotal"
          value={fmtIDR(itemsGross)}
          muted
        />
        <Row
          label="Diskon Item"
          value={`-${fmtIDR(itemDiscountTotal)}`}
          red
        />
        {additionalCharges.map((c) => {
          if (!c || Number(c.amount) <= 0) return null;

          return (
            <Row
              key={c.id ?? c.type}
              label={
                c.type === "PB1"
                  ? "PB1"
                  : c.type === "SERVICE"
                  ? "Service Charge"
                  : c.type
              }
              value={fmtIDR(c.amount)}
            />
          );
        })}
        <Row
          label="Diskon Transaksi"
          value={`-${fmtIDR(headerDisc)}`}
          red
        />
        <div className="border-t border-dashed border-gray-600 my-2" />
        <Row
          label="Total"
          value={fmtIDR(total || grandTotal)}
          bold
        />

        <div className="border-t border-dashed border-gray-600 my-2" />

        {/* Pembayaran */}
        {payments.length ? (
          payments.map((p) => (
            <Row
              key={p.id ?? `${p.method}-${p.amount}`}
              label={`Bayar (${p.method})`}
              value={fmtIDR(toNumber(p.amount))}
            />
          ))
        ) : (
          <Row
            label="Bayar"
            value={fmtIDR(toNumber(paid))}
          />
        )}
        <Row label="Kembali" value={fmtIDR(change)} />

        {/* Member & poin — hanya tampil kalau transaksi pakai member */}
        {member && (
          <>
            <div className="border-t border-dashed border-gray-600 my-2" />
            <Row
              label="Member"
              value={`${member.name}${member.code ? ` (${member.code})` : ""}`}
            />
            {pointsEarned > 0 && (
              <Row label="Poin didapat" value={`+${pointsEarned}`} />
            )}
            {memberPointBalance != null && (
              <Row
                label="Total poin"
                value={String(memberPointBalance)}
                bold
              />
            )}
          </>
        )}

        <div className="border-t border-dashed border-gray-600 my-2" />

        {/* Footer */}
        <div className="text-center py-1">
          <div>Terima kasih 🙏</div>
          <div className="text-[11px] text-gray-700">
            Simpan struk ini sebagai bukti transaksi
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted, red }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-gray-500" : ""}>
        {label}
      </span>
      <span
        className={`${bold ? "font-bold" : ""} ${
          red ? "text-red-600 font-medium" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}