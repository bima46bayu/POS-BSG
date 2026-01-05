import React, { useMemo, useCallback, useState } from "react";
import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReceiptTicket from "../ReceiptTicket";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  subtotal,
  tax,
  globalDiscounts = [],      // ✅ TERIMA DARI PARENT (POSPage / Mobile)
  onSuccess,
  onCancel,
  showSummary = true,
}) {
  const subtotalSafe = useMemo(
    () =>
      typeof subtotal === "number"
        ? subtotal
        : items.reduce(
            (s, i) =>
              s + Number(i.price || 0) * Number(i.quantity || 0),
            0
          ),
    [items, subtotal]
  );

  const taxSafe = useMemo(() => (typeof tax === "number" ? tax : 0), [tax]);

  const [discountAmount, setDiscountAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(subtotalSafe + taxSafe);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reprintAskOpen, setReprintAskOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);

  const queryClient = useQueryClient();

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["sales"], exact: false });

      const createdId = res?.id ?? res?.sale_id ?? res?.data?.id ?? null;
      setSaleId(createdId);

      setReceiptOpen(true);
      setConfirmOpen(false);

      onSuccess?.(res);
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Gagal membuat transaksi";
      toast.error(msg);
    },
  });

  /* =======================
     Dari Payment
     ======================= */
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
    const p = pendingPayment;
    if (!p) return;

    if (p.payment_method === "cash" && Number(p.paid_amount) < grandTotal) {
      return toast.error("Cash received is less than total.");
    }

    const payload = {
      customer_name: p.customer_name || null,
      note: p.note || null,

      items: items.map((i) => {
        const price = Number(i.price || 0);
        const qty = Number(i.quantity || 0);

        const type = i.discount_type || "%";
        const val = Number(i.discount_value || 0);

        const discPerUnit =
          type === "%"
            ? (price * val) / 100
            : val;

        const safeDisc = Math.min(price, discPerUnit);
        const netUnit = Math.max(0, price - safeDisc);

        return {
          product_id: i.product_id ?? i.id,
          qty: qty,          
          unit_price: price,      // 🔥 INI YANG DIMINTA BACKEND

          // opsional tapi sangat dianjurkan
          discount_type: type,
          discount_value: val,
          subtotal: netUnit * qty,

          // kalau backend pakai discount_id
          discount_id: i.item_discount_id ?? null,
        };
      }),

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

      payment_method:
        p.payment_method?.toLowerCase() === "qris"
          ? "QRIS"
          : p.payment_method,
      paid: Number(p.paid_amount || 0),
      status: "completed",
    };

    saleMutation.mutate(payload);
  };

  const handlePrint = () => {
    printNodeById("receipt-print-area");
    setReprintAskOpen(true);
  };

  return (
    <div>
      {showSummary && (
        <OrderSummary
          items={items}
          subtotal={subtotalSafe}
          tax={taxSafe}
          discount={discountAmount}
          total={grandTotal}
        />
      )}

      <Payment
        subtotal={subtotalSafe}
        tax={taxSafe}
        globalDiscounts={globalDiscounts}   // ✅ TERUSKAN KE PAYMENT
        onPayment={handlePayment}
        onCancel={onCancel}
        loading={saleMutation.isLoading}
        onSummaryChange={({ discountAmount, total }) => {
          setDiscountAmount(discountAmount);
          setGrandTotal(total);
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
              Selesaikan transaksi sebesar{" "}
              <b>Rp{grandTotal.toLocaleString("id-ID")}</b> dengan metode{" "}
              <b>{pendingPayment.payment_method}</b>?
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
                {saleMutation.isLoading ? "Memproses..." : "Ya, Bayar"}
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
function Modal({ children, onClose, z = 2147483000, showOverlay = true }) {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const node = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: z }}
      className="flex items-center justify-center py-6"
    >
      {showOverlay && (
        <div
          onClick={onClose}
          className="absolute inset-0 bg-black/40"
        />
      )}
      <div className="relative bg-white rounded-2xl shadow-xl w-[min(560px,92vw)] max-h-[85vh] overflow-auto">
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
