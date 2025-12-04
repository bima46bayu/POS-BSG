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

export default function SaleDetailModal({ open, onClose, sale }) {
  // kalau modal ditutup atau sale belum ada, jangan render apa-apa
  if (!open || !sale) return null;

  const areaId = useMemo(
    () => `receipt-print-area-${sale?.id ?? "unknown"}`,
    [sale?.id]
  );

  // print helper dengan canvas + iframe
  const printTicket = useCallback(async () => {
    const el = document.getElementById(areaId);
    if (!el) return;

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true, // penting supaya logo cross-origin bisa ikut
      ignoreElements: (node) =>
        node.classList?.contains("no-print"),
    });

    const imgData = canvas.toDataURL("image/png");

    // Buat iframe tersembunyi
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";

    document.body.appendChild(iframe);

    const iframeWin = iframe.contentWindow;
    if (!iframeWin) return;

    const iframeDoc = iframeWin.document;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 6mm; }
            body { margin: 0; padding: 0; }
            img { width: 80mm; display: block; }
          </style>
        </head>
        <body>
          <img src="${imgData}">
        </body>
      </html>
    `);
    iframeDoc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframeWin.focus();
          iframeWin.print();

          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (e) {
          console.error("Print error:", e);
          document.body.removeChild(iframe);
        }
      }, 250);
    };
  }, [areaId]);

  // ringkasan
  const subtotal = sale.subtotal ?? 0;
  const discount = sale.discount ?? 0;
  const tax = sale.tax ?? 0;
  const total = sale.total ?? subtotal - discount + tax;
  const paid = sale.paid ?? 0;
  const change = sale.change ?? 0;

  // item detail dari sale_items
  const items = Array.isArray(sale.items) ? sale.items : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[101] w-full max-w-6xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
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

        {/* Body: kiri detail, kanan preview struk */}
        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Kiri */}
          <div className="md:col-span-8 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-500">No. Transaksi</div>
                <div className="font-medium">{sale.code}</div>
              </div>
              <div>
                <div className="text-gray-500">Tanggal</div>
                <div className="font-medium">
                  {new Date(sale.created_at).toLocaleString("id-ID")}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Customer</div>
                <div className="font-medium">
                  {sale.customer_name || "General"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Metode</div>
                <div className="font-medium">
                  {Array.isArray(sale.payments) && sale.payments.length
                    ? sale.payments.map((p) => p.method).join(", ")
                    : "-"}
                </div>
              </div>
            </div>

            {/* Tabel item */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Harga/u</th>
                    <th className="px-4 py-2 text-right">Diskon/u</th>
                    <th className="px-4 py-2 text-right">Net/u</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((it, idx) => {
                      const name =
                        it.name ||
                        it.product_name ||
                        it?.product?.name ||
                        it.sku ||
                        `Item ${idx + 1}`;
                      const qty = Number(it.qty ?? it.quantity ?? 1);
                      const unit = Number(it.unit_price ?? it.price ?? 0);
                      const discU = Number(it.discount_nominal ?? 0);
                      const netU = Number(
                        it.net_unit_price ??
                          (unit - discU < 0 ? 0 : unit - discU)
                      );
                      const lineTotal = Number(
                        it.line_total ??
                          it.subtotal ??
                          Math.max(0, netU) * qty
                      );

                      return (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{name}</td>
                          <td className="px-4 py-2 text-right">{qty}</td>
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
                        className="px-4 py-3 text-gray-500 text-center"
                        colSpan={6}
                      >
                        Tidak ada item
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Ringkasan keuangan */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="px-4 py-2 text-right">Subtotal</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right">
                      Diskon Transaksi
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      - {fmtIDR(discount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right">Pajak</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(tax)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(total)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right">Bayar</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(paid)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right">Kembalian</td>
                    <td className="px-4 py-2 text-right">
                      {fmtIDR(change)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Kanan: preview struk (ReceiptTicket) */}
          <div className="md:col-span-4 border rounded-xl p-3 bg-gray-50">
            <ReceiptTicket saleId={sale.id} printableId={areaId} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
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
