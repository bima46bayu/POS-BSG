// src/components/ReceiptTicket.jsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getSale } from "../api/sales";

const toNumber = (v) =>
  v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")); // lebih aman
const fmtIDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

export default function ReceiptTicket({ saleId, store, printableId = "receipt-print-area" }) {
  const { data: sale, isLoading, isError, error } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: !!saleId,
  });

  if (isLoading) return <div className="p-4 text-sm text-gray-600">Memuat struk…</div>;
  if (isError)   return <div className="p-4 text-sm text-red-600">Gagal memuat struk: {String(error?.message || "unknown")}</div>;

  const code      = sale?.code || sale?.id;
  const cashier   = sale?.cashier?.name || "—";
  const customer  = sale?.customer_name || "—";
  const createdAt = sale?.created_at ? new Date(sale.created_at) : new Date();

  const items     = Array.isArray(sale?.items) ? sale.items : [];
  const tax       = toNumber(sale?.tax);
  const headerDisc= toNumber(sale?.discount);
  const svc       = toNumber(sale?.service_charge); // NEW: service charge jika ada
  const total     = toNumber(sale?.total);
  const paid      = toNumber(sale?.paid);
  const change    = toNumber(sale?.change);
  const payments  = Array.isArray(sale?.payments) ? sale.payments : [];

  // ===== Hitung gross, total diskon item, dan subtotal net dari items =====
  let itemsGross = 0;
  let itemDiscountTotal = 0;
  let itemsNetSubtotal = 0;

  const renderedItems = items.map((it) => {
    const name = it?.product?.name || it?.name || `Item #${it?.id ?? ""}`;
    const qty  = toNumber(it?.qty ?? it?.quantity ?? 1);

    // Ambil kolom-kolom yang mungkin tersedia dari server:
    const unitPrice = toNumber(it?.unit_price ?? it?.price ?? 0);
    const netUnit   = toNumber(it?.net_unit_price ?? 0);
    const discNom   = toNumber(it?.discount_nominal ?? (unitPrice && netUnit ? unitPrice - netUnit : 0));
    const lineTotal = toNumber(it?.line_total ?? it?.subtotal ?? (Math.max(0, (unitPrice - discNom)) * qty));

    // Akumulasi ringkasan:
    itemsGross       += unitPrice * qty;
    itemDiscountTotal+= Math.min(unitPrice, discNom) * qty;
    itemsNetSubtotal += lineTotal;

    return { id: it.id, name, qty, unitPrice, discNom, netUnit: netUnit || Math.max(0, unitPrice - discNom), lineTotal };
  });

  const computedSubtotalNet = itemsNetSubtotal; // setelah diskon item
  // Jika backend tidak kirim service_charge, svc = 0 (aman)
  const grandTotal = Math.max(0, computedSubtotalNet - headerDisc + svc + tax);

  return (
    <div className="p-0">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 6mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id={printableId}
        className="bg-white text-black mx-auto"
        style={{ width: 280, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
      >
        {/* Header toko */}
        <div className="text-center py-1">
          <div className="font-bold uppercase tracking-wide">{store?.name || "INSTAFACTORY"}</div>
          {store?.address && <div className="text-[11px] text-gray-700">{store.address}</div>}
          {store?.phone && <div className="text-[11px] text-gray-700">Telp: {store.phone}</div>}
        </div>

        <Hr />

        {/* Info transaksi */}
        <Row label="No" value={String(code)} />
        <Row label="Tanggal" value={createdAt.toLocaleString("id-ID")} />
        <Row label="Kasir" value={cashier} />
        <Row label="Customer" value={customer} />

        <Hr />

        {/* Items */}
        <div className="pb-1">
          {renderedItems.map((it) => (
            <div key={it.id ?? `${it.name}-${it.qty}-${it.unitPrice}`} className="mb-1">
              <div className="truncate">{it.name}</div>

              {/* baris harga */}
              <div className="flex justify-between">
                <span className="text-gray-700">
                  {it.qty} x {fmtIDR(it.unitPrice)}
                </span>
                <span className="font-medium">{fmtIDR(it.lineTotal)}</span>
              </div>

              {/* tampilkan diskon/u kalau ada */}
              {it.discNom > 0 && (
                <div className="flex justify-between text-[11px] text-gray-600">
                  <span>Disc/u {fmtIDR(it.discNom)} → Net/u {fmtIDR(it.netUnit)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <Hr />

        {/* Ringkasan */}
        <Row label="Subtotal (gross)" value={fmtIDR(itemsGross)} muted />
        <Row label="Item Discount" value={`-${fmtIDR(itemDiscountTotal)}`} red />
        {/* <Row label="Subtotal (net)" value={fmtIDR(computedSubtotalNet)} /> */}
        {svc ? <Row label="Service Charge" value={fmtIDR(svc)} /> : null}
        <Row label="Tax" value={fmtIDR(tax)} />
        <Row label="Discount Transaction" value={`-${fmtIDR(headerDisc)}`} red />
        <Hr />
        <Row label="Total" value={fmtIDR(total || grandTotal)} bold />

        <Hr />

        {/* Pembayaran */}
        {payments.length > 0 ? (
          payments.map((p) => (
            <Row key={p.id ?? `${p.method}-${p.amount}`} label={`Bayar (${p.method})`} value={fmtIDR(toNumber(p.amount))} />
          ))
        ) : (
          <Row label="Bayar" value={fmtIDR(paid)} />
        )}
        <Row label="Kembali" value={fmtIDR(change)} />

        <Hr />

        {/* Footer */}
        <div className="text-center py-1">
          <div>Terima kasih 🙏</div>
          <div className="text-[11px] text-gray-700">Simpan struk ini sebagai bukti transaksi</div>
        </div>
      </div>
    </div>
  );
}

function Hr() {
  return <div className="border-t border-dashed border-gray-400 my-2" />;
}
function Row({ label, value, bold, muted, red }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-gray-500" : ""}>{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${red ? "text-red-600 font-medium" : ""}`}>{value}</span>
    </div>
  );
}
