import React from "react";
import { X } from "lucide-react";

const fmtIDR = (n) =>
  Number(n ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

// helper warna badge metode pembayaran
const paymentBadgeClass = (method) => {
  const m = String(method || "").toLowerCase();
  if (m === "qris")
    return "bg-purple-50 text-purple-700 border-purple-200";
  if (m === "transfer")
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (m === "cash")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

export default function HistoryItemDetailModal({ open, onClose, row, filters }) {
  if (!open || !row) return null;

  const { dateFrom, dateTo, paymentMethod } = filters || {};
  const transactions = row.transactions || [];

  const totalQty = transactions.reduce(
    (sum, t) => sum + (Number(t.qty) || 0),
    0
  );
  const totalAmount = transactions.reduce(
    (sum, t) => sum + (Number(t.total) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col">
        {/* header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Detail Transaksi per Produk
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {row.product_name} · SKU:{" "}
              <span className="font-medium text-gray-800">
                {row.sku || "-"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* summary */}
        <div className="px-6 py-3 border-b bg-gray-50/80">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div className="space-y-1">
              <div className="text-gray-500">Periode</div>
              <div className="font-medium text-gray-900">
                {dateFrom || "All"} &ndash; {dateTo || "All"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500">Metode Pembayaran</div>
              <div
                className={
                  "inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium " +
                  (paymentMethod
                    ? paymentBadgeClass(paymentMethod)
                    : "bg-gray-50 text-gray-700 border-gray-200")
                }
              >
                {paymentMethod ? paymentMethod.toUpperCase() : "All Methods"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500">Total Transaksi</div>
              <div className="font-semibold text-gray-900">
                {transactions.length.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500">Ringkasan</div>
              <div className="flex flex-col">
                <span className="text-gray-800">
                  Qty:{" "}
                  <span className="font-semibold">
                    {totalQty.toLocaleString("id-ID")}
                  </span>
                </span>
                <span>
                  Amount:{" "}
                  <span className="font-semibold">
                    {fmtIDR(totalAmount)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* table */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 text-left font-semibold w-10">
                  #
                </th>
                <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">
                  No. Transaksi
                </th>
                <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">
                  Tanggal
                </th>
                <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">
                  Metode
                </th>
                <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                  Qty
                </th>
                <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                  Harga
                </th>
                <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                  Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Tidak ada transaksi pada periode ini.
                  </td>
                </tr>
              )}

              {transactions.map((t, idx) => (
                <tr
                  key={t.id ?? t.transaction_no ?? idx}
                  className="hover:bg-gray-50/80"
                >
                  <td className="px-4 py-2 text-gray-400 text-center">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">
                    {t.transaction_no || t.sale_no || "-"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                    {t.date
                      ? new Date(t.date).toLocaleString("id-ID")
                      : t.created_at
                      ? new Date(t.created_at).toLocaleString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium " +
                        paymentBadgeClass(t.payment_method)
                      }
                    >
                      {(t.payment_method || "-").toString().toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                    {(Number(t.qty) || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                    {fmtIDR(t.price)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                    {fmtIDR(t.total)}
                  </td>
                </tr>
              ))}
            </tbody>

            {transactions.length > 0 && (
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td
                    className="px-4 py-2 font-semibold text-gray-700"
                    colSpan={4}
                  >
                    Total
                  </td>
                  <td className="px-4 py-2 font-semibold text-right tabular-nums text-gray-900">
                    {totalQty.toLocaleString("id-ID")}
                  </td>
                  <td />
                  <td className="px-4 py-2 font-semibold text-right tabular-nums text-gray-900">
                    {fmtIDR(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* footer */}
        <div className="px-6 py-3 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
