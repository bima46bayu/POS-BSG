import React, { useState } from "react";
import html2canvas from "html2canvas";
import { ChevronDown, ChevronRight } from "lucide-react";

function ModalShell({ open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={
          "relative bg-white rounded-2xl shadow-xl overflow-auto " +
          (wide
            ? "w-[min(1100px,96%)] max-h-[92vh]"
            : "w-[min(720px,100%)] max-h-[90vh]")
        }
      >
        {children}
      </div>
    </div>
  );
}

export function OpenRegisterModal({ open, onClose, onSubmit, loading }) {
  const [openingCash, setOpeningCash] = useState("0");
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      opening_cash: Number(openingCash || 0),
      note: note || null,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Open Register</h3>
        <p className="text-xs text-gray-500">
          Anda harus membuka register sebelum menggunakan POS. Session akan
          tetap aktif sampai Anda menutup register.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opening Cash (IDR)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            className="w-full h-11 rounded-full border px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Opsional, bisa 0 jika tidak mencatat kas awal.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note (optional)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-2xl border px-4 py-2 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Shift info, cashier name, dll."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            className="h-11 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Opening…" : "Open Register"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RegisterSummaryRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span
        className={
          "font-semibold " +
          (highlight === "neg"
            ? "text-red-600"
            : highlight === "pos"
            ? "text-green-600"
            : "text-gray-800")
        }
      >
        {value}
      </span>
    </div>
  );
}

async function printRegisterTicketById(id = "register-summary-print-area") {
  const el = document.getElementById(id);
  if (!el) return;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          @page { size: 80mm auto; margin: 6mm; }
          body { margin: 0; }
          img { width: 80mm; display: block; }
        </style>
      </head>
      <body>
        <img src="${imgData}" />
      </body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };
}

export function RegisterSummaryModal({
  open,
  onClose,
  data,
  isClosed,
  closing,
  onCloseRegister,
}) {
  const expectedCash = data?.totals?.expected_cash ?? 0;
  const [closingCash, setClosingCash] = useState(
    () => String(expectedCash || "0")
  );
  const [noteClose, setNoteClose] = useState("");

  // Keep closing cash in sync when data opens or expected_cash changes
  React.useEffect(() => {
    if (open && data?.totals != null)
      setClosingCash(String(data.totals.expected_cash ?? 0));
  }, [open, data?.totals?.expected_cash]);

  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const toggleExpand = (id) => {
    setExpandedSaleId((prev) => (prev === id ? null : id));
  };

  if (!open || !data) return null;
  const { session, summary, totals, sales } = data || {};

  const handlePrint = () => {
    printRegisterTicketById();
  };

  const handleCloseRegister = () => {
    onCloseRegister({
      closing_cash: Number(closingCash) || 0,
      note: noteClose || null,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose} wide>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Register Summary
            </h2>
            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
              <div>
                <span className="inline-block w-20">Session ID</span>
                <span className="font-medium">
                  #{summary?.session_id ?? session?.id}
                </span>
              </div>
              <div>
                <span className="inline-block w-20">Opened</span>
                <span>{summary?.opened_at}</span>
              </div>
              <div>
                <span className="inline-block w-20">Closed</span>
                <span>{summary?.closed_at}</span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{summary?.store_name}</div>
            <div>Cashier: {summary?.cashier_name}</div>
          </div>
        </div>

        {/* Top summary + mini ticket */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] gap-4">
          {/* Left: big summary cards */}
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <RegisterSummaryRow
                label="Total Transactions"
                value={totals?.total_transactions ?? 0}
              />
              <RegisterSummaryRow
                label="Total Sales"
                value={
                  "Rp" +
                  Number(totals?.total_sales ?? 0).toLocaleString("id-ID")
                }
              />
              <RegisterSummaryRow
                label="Cash Payments"
                value={
                  "Rp" +
                  Number(totals?.cash_payments ?? 0).toLocaleString("id-ID")
                }
              />
              <RegisterSummaryRow
                label="Non-Cash Payments"
                value={
                  "Rp" +
                  Number(totals?.non_cash_payments ?? 0).toLocaleString(
                    "id-ID"
                  )
                }
              />
              {(totals?.void_transactions ?? 0) > 0 && (
                <>
                  <RegisterSummaryRow
                    label="Void Transactions"
                    value={totals?.void_transactions ?? 0}
                  />
                  <RegisterSummaryRow
                    label="Void Amount"
                    value={
                      "Rp" +
                      Number(totals?.void_amount ?? 0).toLocaleString("id-ID")
                    }
                    highlight="neg"
                  />
                </>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <RegisterSummaryRow
                label="Opening Cash"
                value={
                  "Rp" +
                  Number(totals?.opening_cash ?? 0).toLocaleString("id-ID")
                }
              />
              <RegisterSummaryRow
                label="Expected Cash"
                value={
                  "Rp" +
                  Number(totals?.expected_cash ?? 0).toLocaleString("id-ID")
                }
              />
              <RegisterSummaryRow
                label="Closing Cash"
                value={
                  "Rp" +
                  Number(totals?.closing_cash ?? 0).toLocaleString("id-ID")
                }
              />
              <RegisterSummaryRow
                label="Difference"
                value={
                  "Rp" +
                  Number(totals?.difference ?? 0).toLocaleString("id-ID")
                }
                highlight={
                  (totals?.difference ?? 0) < 0
                    ? "neg"
                    : (totals?.difference ?? 0) > 0
                    ? "pos"
                    : undefined
                }
              />
            </div>
          </div>

          {/* Right: receipt-style mini ticket */}
          <div
            id="register-summary-print-area"
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-800 shadow-sm"
          >
            <div className="text-center font-semibold text-gray-900">
              REGISTER SUMMARY
            </div>
            <div className="text-center text-[11px] text-gray-500 mb-2">
              Session #{summary?.session_id ?? session?.id}
            </div>
            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Opened</span>
                <span className="font-medium">{summary?.opened_at}</span>
              </div>
              <div className="flex justify-between">
                <span>Closed</span>
                <span className="font-medium">{summary?.closed_at}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Opening Cash</span>
                <span className="font-medium">
                  Rp{Number(totals?.opening_cash ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Closing Cash</span>
                <span className="font-medium">
                  Rp{Number(totals?.closing_cash ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Total Transactions</span>
                <span className="font-medium">
                  {totals?.total_transactions ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Sales</span>
                <span className="font-medium">
                  Rp{Number(totals?.total_sales ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cash Payments</span>
                <span className="font-medium">
                  Rp{Number(totals?.cash_payments ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Non-Cash Payments</span>
                <span className="font-medium">
                  Rp
                  {Number(totals?.non_cash_payments ?? 0).toLocaleString(
                    "id-ID"
                  )}
                </span>
              </div>
              {(totals?.void_transactions ?? 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Void Transactions</span>
                    <span className="font-medium">
                      {totals?.void_transactions ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Void Amount</span>
                    <span className="font-medium text-red-600">
                      Rp{Number(totals?.void_amount ?? 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Expected Cash</span>
                <span className="font-medium">
                  Rp{Number(totals?.expected_cash ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Difference</span>
                <span
                  className={
                    "font-semibold " +
                    ((totals?.difference ?? 0) < 0
                      ? "text-red-600"
                      : (totals?.difference ?? 0) > 0
                      ? "text-emerald-600"
                      : "text-gray-900")
                  }
                >
                  Rp{Number(totals?.difference ?? 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {session?.note_close && (
              <>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="text-left text-[11px]">
                  <span className="font-semibold">Note:</span>{" "}
                  <span>{session.note_close}</span>
                </div>
              </>
            )}

            <div className="border-t border-dashed border-gray-300 my-3" />
            <div className="text-center text-[11px] text-gray-500 space-y-0.5">
              <div>End of register</div>
              <div>Simpan struk ini sebagai bukti tutup kas</div>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-800">
              Transaction History
            </h4>
            <span className="text-xs text-gray-500">
              {sales?.length ?? 0} records
            </span>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="w-9 px-1 py-2" aria-label="Expand" />
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales && sales.length > 0 ? (
                  sales.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="w-9 px-1 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.id)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                            aria-expanded={expandedSaleId === row.id}
                            title={expandedSaleId === row.id ? "Collapse" : "Show items"}
                          >
                            {(row.items?.length ?? 0) > 0 ? (
                              expandedSaleId === row.id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )
                            ) : (
                              <span className="w-4 h-4 inline-block" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {row.code}
                        </td>
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2">{row.customer}</td>
                        <td className="px-3 py-2 text-right">
                          Rp{Number(row.total ?? 0).toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={
                              "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium " +
                              (row.status === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.status === "void"
                                ? "bg-red-50 text-red-700"
                                : "bg-gray-50 text-gray-600")
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                      {expandedSaleId === row.id && (row.items?.length ?? 0) > 0 && (
                        <tr className="border-t border-gray-100 bg-gray-50/70">
                          <td colSpan={6} className="px-3 py-2">
                            <div className="text-[11px] text-gray-600 pl-6">
                              <div className="font-medium text-gray-700 mb-1">Items sold</div>
                              <ul className="space-y-0.5">
                                {(row.items || []).map((item, idx) => (
                                  <li key={idx} className="flex justify-between gap-4">
                                    <span>
                                      {item.product_name}
                                      {item.product_sku ? ` (${item.product_sku})` : ""} × {item.qty}
                                    </span>
                                    <span className="font-medium text-gray-800">
                                      Rp{Number(item.line_total ?? 0).toLocaleString("id-ID")}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      Tidak ada transaksi pada session ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Closing cash input when register not yet closed */}
        {!isClosed && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">
              Closing details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Closing Cash (IDR) <span className="text-gray-500 font-normal">required</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount counted in drawer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Expected: Rp{Number(totals?.expected_cash ?? 0).toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={noteClose}
                  onChange={(e) => setNoteClose(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. End of shift"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          {isClosed ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-full border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
              >
                Tutup
              </button>
              {!!session?.closed_at && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-10 px-4 rounded-full border border-blue-600 text-blue-600 text-xs font-semibold hover:bg-blue-50"
                >
                  Print Struk
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-full border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCloseRegister}
                disabled={closing}
                className="h-10 px-4 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {closing ? "Closing…" : "Close Register"}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

