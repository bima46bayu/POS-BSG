// src/components/pos/SaleSubmitter.jsx
import React, { useMemo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";

import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import ReceiptTicket from "../ReceiptTicket";

/* =======================
   Print helper
   ======================= */
async function printNodeById(id = "receipt-print-area") {
  const el = document.getElementById(id);
  if (!el) return;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    ignoreElements: (node) => node.classList?.contains("no-print"),
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

/* =======================
   Main Component
   ======================= */
export default function SaleSubmitter({
  items = [],
  globalDiscounts = [],
  additionalCharges = [], // PB1 & SERVICE (preview only)
  onSuccess,
  onCancel,
  showSummary = true,
}) {
  /* =====================================================
     NET ITEM SUBTOTAL (IKUT BACKEND)
     - diskon item dihitung PER ITEM
     - dibulatkan PER LINE
     ===================================================== */
  const netItemSubtotal = useMemo(() => {
    return items.reduce((sum, i) => {
      const price = Number(i.price || 0);
      const qty = Number(i.quantity || 0);
      if (qty <= 0) return sum;

      const lineBase = price * qty;

      const type = i.discount_type || "%";
      const val = Number(i.discount_value || 0);

      let disc = 0;
      if (val > 0) {
        if (type === "%") {
          disc = lineBase * (val / 100);
        } else {
          disc = val;
        }
      }

      disc = Math.min(disc, lineBase);

      // 🔥 ROUND PER LINE (SAMA DENGAN BACKEND)
      const netLine = Math.round((lineBase - disc) * 100) / 100;

      return sum + netLine;
    }, 0);
  }, [items]);

  /* =======================
     GLOBAL DISCOUNT (TRANSACTION)
     ======================= */
  const [discountAmount, setDiscountAmount] = useState(0);

  /* =====================================================
     GRAND TOTAL ALA BACKEND
     grandTotal = netItemSubtotal - globalDiscount
     ===================================================== */
  const grandTotalBEStyle = useMemo(() => {
    return Math.max(0, netItemSubtotal - discountAmount);
  }, [netItemSubtotal, discountAmount]);

  /* =======================
     ADDITIONAL CHARGES (PB1 / SERVICE)
     BASE = grandTotalBEStyle
     ======================= */
  const additionalTotal = useMemo(() => {
    return additionalCharges
      .filter((c) => c.is_active)
      .reduce((sum, c) => {
        const amount =
          c.calc_type === "PERCENT"
            ? (grandTotalBEStyle * Number(c.value || 0)) / 100
            : Number(c.value || 0);

        // backend round 2 decimal
        return sum + Math.round(amount * 100) / 100;
      }, 0);
  }, [additionalCharges, grandTotalBEStyle]);

  /* =======================
     TOTAL PREVIEW (SAMA BE)
     ======================= */
  const previewTotal = useMemo(() => {
    return Math.max(0, grandTotalBEStyle + additionalTotal);
  }, [grandTotalBEStyle, additionalTotal]);

  /* =======================
     MUTATION
     ======================= */
  const queryClient = useQueryClient();

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["sales"], exact: false });

      const createdId = res?.id ?? res?.data?.id ?? null;
      setSaleId(createdId);

      setReceiptOpen(true);
      setConfirmOpen(false);

      onSuccess?.(res);
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Gagal membuat transaksi"
      );
    },
  });

  /* =======================
     PAYMENT FLOW
     ======================= */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);

  const handlePayment = useCallback(
    (payloadFromPayment) => {
      if (!items.length) {
        toast.error("Cart is empty.");
        return;
      }
      setPendingPayment(payloadFromPayment);
      setConfirmOpen(true);
    },
    [items]
  );

  /* =======================
     CONFIRM & SUBMIT
     ======================= */
  const confirmAndSubmit = () => {
    if (!pendingPayment) return;
    const p = pendingPayment;

    // FE TIDAK VALIDASI TOTAL
    // FE TIDAK KIRIM TOTAL
    // BACKEND = SOURCE OF TRUTH

    const payload = {
      customer_name: p.customer_name || null,
      note: p.note || null,

      items: items.map((i) => ({
        product_id: i.product_id ?? i.id,
        qty: Number(i.quantity || 0),
        unit_price: Number(i.price || 0),
        discount_id: i.item_discount_id ?? null,
      })),

      global_discount_id: p.global_discount_id ?? null,

      payments: [
        {
          method:
            p.payment_method?.toLowerCase() === "qris"
              ? "QRIS"
              : p.payment_method,
          amount: Number(p.paid_amount || 0),
          reference: p.reference || null,
        },
      ],
    };

    saleMutation.mutate(payload);
  };

  /* =======================
     PRINT
     ======================= */
  const handlePrint = () => {
    printNodeById("receipt-print-area");
  };

  /* =======================
     RENDER
     ======================= */
  return (
    <div>
      {showSummary && (
        <OrderSummary
          items={items}
          subtotal={netItemSubtotal}
          discount={discountAmount}
          additionalCharges={additionalCharges}
          total={previewTotal}
        />
      )}

      <Payment
        subtotal={netItemSubtotal}
        total={previewTotal}
        globalDiscounts={globalDiscounts}
        onPayment={handlePayment}
        onCancel={onCancel}
        loading={saleMutation.isLoading}
        onSummaryChange={({ discountAmount }) => {
          setDiscountAmount(discountAmount);
        }}
      />

      {/* CONFIRM MODAL */}
      {confirmOpen && pendingPayment && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">
              Konfirmasi Pembayaran
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Metode <b>{pendingPayment.payment_method}</b> dengan nominal{" "}
              <b>
                Rp
                {Number(pendingPayment.paid_amount || 0).toLocaleString(
                  "id-ID"
                )}
              </b>
              ?
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 h-10 border rounded-full"
                onClick={() => setConfirmOpen(false)}
              >
                Batal
              </button>
              <button
                className="flex-1 h-10 bg-blue-600 text-white rounded-full"
                onClick={confirmAndSubmit}
                disabled={saleMutation.isLoading}
              >
                {saleMutation.isLoading ? "Memproses..." : "Bayar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* RECEIPT */}
      {receiptOpen && (
        <Modal onClose={() => setReceiptOpen(false)} z={10000}>
          <div className="p-4 pb-20">
            <h3 className="text-lg font-semibold mb-2">
              Transaction Success
            </h3>

            <div className="max-h-[60vh] overflow-auto rounded-lg bg-gray-50 p-3">
              <ReceiptTicket saleId={saleId} />
            </div>

            <div className="sticky bottom-0 bg-white border-t mt-4 p-4 flex gap-3">
              <button
                className="flex-1 h-11 border border-red-600 text-red-600 rounded-full"
                onClick={() => setReceiptOpen(false)}
              >
                Close
              </button>
              <button
                className="flex-1 h-11 bg-blue-600 text-white rounded-full"
                onClick={handlePrint}
              >
                Print
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =======================
   Modal
   ======================= */
function Modal({ children, onClose, z = 2147483000 }) {
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: z }}
      className="flex items-center justify-center py-6"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-[min(560px,92vw)] max-h-[85vh] overflow-auto">
        {children}
      </div>
    </div>,
    document.body
  );
}
