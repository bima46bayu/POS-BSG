// src/components/sales/SaleDetailModal.jsx
import React, { useCallback, useMemo } from "react";
import ReceiptTicket from "../ReceiptTicket";
import { X } from "lucide-react";
import html2canvas from "html2canvas";

const fmtIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

/**
 * Ambil additional charge dari snapshot backend
 * type: "PB1" | "SERVICE"
 */
const getAdditionalAmount = (sale, type) => {
  if (!Array.isArray(sale?.additional_charges_snapshot)) return 0;

  const found = sale.additional_charges_snapshot.find(
    (c) =>
      String(c.type).toUpperCase() === String(type).toUpperCase()
  );

  return Number(found?.amount ?? 0);
};

export default function SaleDetailModal({ open, onClose, sale }) {
  if (!open || !sale) return null;

  const areaId = useMemo(
    () => `receipt-print-area-${sale?.id ?? "unknown"}`,
    [sale?.id]
  );

  /* ================= Print ================= */
  const printTicket = useCallback(async () => {
    const el = document.getElementById(areaId);
    if (!el) return;

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      ignoreElements: (node) =>
        node.classList?.contains("no-print"),
    });

    const imgData = canvas.toDataURL("image/png");

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win) return;

    win.document.open();
    win.document.write(`
      <html>
        <head>
          <style>
            @page { size: 80mm auto; margin: 6mm; }
            body { margin: 0 }
            img { width: 80mm; display: block }
          </style>
        </head>
        <body>
          <img src="${imgData}" />
        </body>
      </html>
    `);
    win.document.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          win.focus();
          win.print();
          setTimeout(
            () => document.body.removeChild(iframe),
            800
          );
        } catch {
          document.body.removeChild(iframe);
        }
      }, 250);
    };
  }, [areaId]);

  /* ================= Ringkasan (SINGLE SOURCE) ================= */
  const subtotal = Number(sale.subtotal ?? 0);
  const discount = Number(sale.discount ?? 0);

  const pb1 = getAdditionalAmount(sale, "PB1");
  const serviceCharge = getAdditionalAmount(sale, "SERVICE");

  const total = Number(sale.total ?? 0); // ⬅️ JANGAN HITUNG ULANG
  const paid = Number(sale.paid ?? 0);
  const change = Number(sale.change ?? 0);

  const items = Array.isArray(sale.items) ? sale.items : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-[101] w-full max-w-6xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* ===== Header ===== */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Detail Transaksi
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== Body ===== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* ===== Kiri ===== */}
          <div className="md:col-span-8 space-y-4 text-sm">
            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
              <Info label="No. Transaksi" value={sale.code} />
              <Info
                label="Tanggal"
                value={new Date(sale.created_at).toLocaleString(
                  "id-ID"
                )}
              />
              <Info
                label="Customer"
                value={sale.customer_name || "General"}
              />
              <Info
                label="Metode"
                value={
                  Array.isArray(sale.payments) &&
                  sale.payments.length
                    ? sale.payments.map((p) => p.method).join(", ")
                    : "-"
                }
              />
            </div>

            {/* Items */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Harga/u</th>
                    <th className="px-4 py-2 text-right">
                      Diskon/u
                    </th>
                    <th className="px-4 py-2 text-right">Net/u</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((it, idx) => {
                      const qty = Number(
                        it.qty ?? it.quantity ?? 1
                      );
                      const unit = Number(
                        it.unit_price ?? it.price ?? 0
                      );
                      const discU = Number(
                        it.discount_nominal ?? 0
                      );
                      const netU = Math.max(0, unit - discU);
                      const lineTotal = Number(
                        it.line_total ??
                          it.subtotal ??
                          netU * qty
                      );

                      return (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">
                            {it.name ||
                              it.product_name ||
                              it?.product?.name ||
                              `Item ${idx + 1}`}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {qty}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {fmtIDR(unit)}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600">
                            - {fmtIDR(discU)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {fmtIDR(netU)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {fmtIDR(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-center text-gray-500"
                      >
                        Tidak ada item
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== Ringkasan ===== */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <SummaryRow label="Subtotal" value={subtotal} />
                  <SummaryRow
                    label="Diskon Transaksi"
                    value={-discount}
                    red
                  />

                  {pb1 > 0 && (
                    <SummaryRow label="PB1" value={pb1} />
                  )}

                  {serviceCharge > 0 && (
                    <SummaryRow
                      label="Service Charge"
                      value={serviceCharge}
                    />
                  )}

                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(total)}
                    </td>
                  </tr>

                  <SummaryRow label="Bayar" value={paid} />
                  <SummaryRow label="Kembalian" value={change} />
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== Kanan ===== */}
          <div className="md:col-span-4 border rounded-xl p-3 bg-gray-50">
            <ReceiptTicket saleId={sale.id} printableId={areaId} />
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={printTicket}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Print Struk
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Helpers ===== */
function Info({ label, value }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, red }) {
  return (
    <tr>
      <td className="px-4 py-2 text-right">{label}</td>
      <td
        className={`px-4 py-2 text-right ${
          red ? "text-red-600" : ""
        }`}
      >
        {fmtIDR(value)}
      </td>
    </tr>
  );
}
