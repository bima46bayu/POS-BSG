// src/components/pos/SaleSubmitter.jsx
import React, { useMemo, useCallback, useState } from "react";
import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReceiptTicket from "../ReceiptTicket";
import toast from "react-hot-toast";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* =======================
   Print helper (window.print)
   ======================= */
async function printNodeById(id = "receipt-print-area") {
  const el = document.getElementById(id);
  if (!el) return;

  const canvas = await html2canvas(el, { 
    scale: 2, 
    backgroundColor: "#ffffff" 
  });
  
  const imgData = canvas.toDataURL("image/png");
  
  // Buat iframe tersembunyi
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentWindow.document;
  
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
  
  // Tunggu gambar load, lalu print
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Hapus iframe setelah print selesai
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      } catch (e) {
        console.error("Print error:", e);
        document.body.removeChild(iframe);
      }
    }, 250);
  };
}

/* =======================
   Export to PDF helper
   ======================= */
async function exportReceiptToPdf(id = "receipt-print-area", mode = "download") {
  const el = document.getElementById(id);
  if (!el) return;

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");

  const pageWidthMm = 80;
  const marginX = 4;
  const marginY = 12;
  const usableWidthMm = pageWidthMm - marginX * 2;
  const pageHeightMm = (canvas.height * usableWidthMm) / canvas.width;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidthMm, pageHeightMm + marginY * 2],
  });

  pdf.addImage(imgData, "PNG", marginX, marginY, usableWidthMm, pageHeightMm);

  if (mode === "download") {
    pdf.save("receipt.pdf");
  } else if (mode === "preview") {
    window.open(pdf.output("bloburl"), "_blank");
  }
}

/* =======================
   Main Component
   ======================= */
export default function SaleSubmitter({
  items = [],
  subtotal,
  tax,
  total, // tidak dipakai—total dihitung dari payment/summary
  onSuccess,
  onCancel,
  showSummary = true,
}) {
  const subtotalSafe = useMemo(
    () =>
      typeof subtotal === "number"
        ? subtotal
        : items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0),
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
  
  React.useEffect(() => {
    const handleAfterPrint = () => {
      // Force update semua state untuk re-attach listeners
      setConfirmOpen(prev => prev);
      setReceiptOpen(prev => prev);
      setReprintAskOpen(prev => prev);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const queryClient = useQueryClient();

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      // patch stok cepat di cache products
      queryClient.setQueriesData({ queryKey: ["products"] }, (old) => {
        if (!old) return old;
        const sold = new Map(
          (Array.isArray(res?.items) ? res.items : []).map((it) => [
            it.product_id,
            Number(it.qty || 0),
          ])
        );
        const patchPage = (page) => {
          const arr = Array.isArray(page?.items) ? page.items : [];
          const patched = arr.map((p) => {
            const dec = sold.get(p.id) || 0;
            const current = Number(p.stock ?? p.qty ?? p.quantity ?? 0);
            return dec ? { ...p, stock: Math.max(0, current - dec) } : p;
          });
          return { ...page, items: patched };
        };
        return old.pages ? { ...old, pages: old.pages.map(patchPage) } : patchPage(old);
      });

      // refresh list
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["sales"], exact: false });

      const createdId = res?.id ?? res?.sale_id ?? res?.data?.id ?? null;
      setSaleId(createdId);
      if (createdId) {
        queryClient.invalidateQueries({ queryKey: ["sale", createdId] });
      }

      setReceiptOpen(true);
      setConfirmOpen(false);

      onSuccess?.(res);
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        err?.message ||
        "Gagal membuat transaksi";
      console.error("Create sale failed:", err?.response || err);
      toast.error(msg);
    },
  });

  const handlePayment = useCallback(
    (payloadFromPayment) => {
      if (!items.length) return toast.error("Cart is empty.");
      setPendingPayment(payloadFromPayment);
      setConfirmOpen(true);
    },
    [items]
  );

  const confirmAndSubmit = () => {
    const p = pendingPayment;
    if (!p) return;

    // Hitung subtotal & siapkan items
    let subtotalCalc = 0;
    let itemsPayload;
    try {
      itemsPayload = items.map((i) => {
        const price = Number(i.price || 0);
        const type = (i.discount_type || "rp").toLowerCase(); // '%', 'rp'
        const val = Number(i.discount_value || 0);

        const discPerUnit =
          type === "%" ? (price * val) / 100 : val;
        const discNominalSafe = Math.max(0, Math.min(price, discPerUnit));
        const net = Math.max(0, price - discNominalSafe);

        const qty = Number(i.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error("Ada item dengan quantity <= 0 atau bukan angka");
        }

        subtotalCalc += net * qty;

        return {
          product_id: i.product_id ?? i.id,
          qty,
          unit_price: Math.round(price * 100) / 100,
          discount_nominal: Math.round(discNominalSafe * 100) / 100, // per unit
        };
      });
    } catch (e) {
      return toast.error(e.message || "Item tidak valid");
    }

    const taxCalc = Number(taxSafe || 0);
    const headerDisc = Number(p.discount_amount || 0);

    const totalCalc =
      typeof p.total === "number"
        ? p.total
        : Math.max(0, subtotalCalc - headerDisc + taxCalc);

    if (p.payment_method === "cash" && Number(p.paid_amount) < totalCalc) {
      return toast.error("Cash received is less than total.");
    }

    const paid = Math.round(Number(p.paid_amount || 0) * 100) / 100;
    const change = Math.max(0, Math.round((paid - totalCalc) * 100) / 100);

    // Normalisasi discount_type header
    const normDiscountType =
      (p.discount_type || "").toLowerCase() === "%" ? "percent"
      : (p.discount_type || "").toLowerCase() === "rp" ? "amount"
      : null;

    // Payload "kompatibel" dengan backend lama
    const payload = {
      customer_name: p.customer_name || null,

      // field tipikal yang sering divalidasi backend
      subtotal: Math.round(subtotalCalc * 100) / 100,
      discount: Math.round(headerDisc * 100) / 100,
      tax: Math.round(taxCalc * 100) / 100,
      total: Math.round(totalCalc * 100) / 100,
      paid,
      change,
      status: "completed", // sesuaikan jika backend pakai 'paid'/'completed'

      // detail item
      items: itemsPayload,

      // kalau backend mendukung multi-payment, ini ikut terkirim
      payments: [
        {
          method:
            p.payment_method?.toLowerCase() === "qris" ? "QRIS" : p.payment_method,
          amount: paid,
          reference: p.reference || null,
        },
      ],

      // metadata opsional / kompatibilitas
      payment_method:
        p.payment_method?.toLowerCase() === "qris" ? "QRIS" : p.payment_method,
      note: p.note || null,

      discount_type: normDiscountType, // 'percent' | 'amount' | null
      discount_value: Number(p.discount_value || 0),
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
          taxRate={0.11}
        />
      )}

      <Payment
        subtotal={subtotalSafe}
        tax={taxSafe}
        onPayment={handlePayment}
        onCancel={onCancel}
        loading={saleMutation.isLoading}
        onSummaryChange={({ discountAmount, total }) => {
          setDiscountAmount(discountAmount);
          setGrandTotal(total);
        }}
      />

      {/* Konfirmasi */}
      {confirmOpen && pendingPayment && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Konfirmasi Pembayaran</h3>
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

      {/* Popup Struk */}
      {receiptOpen && (
        <Modal onClose={() => setReceiptOpen(false)}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Transaction Success</h3>

            {/* Biarkan ReceiptTicket ambil data detailnya dengan saleId */}
            <ReceiptTicket saleId={saleId} />

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                className="flex-1 h-10 border rounded-full border-red-600 text-red-600"
                onClick={() => setReceiptOpen(false)}
              >
                Close
              </button>
              <button
                className="flex-1 h-10 border border-blue-600 text-blue-600 rounded-full"
                onClick={() => exportReceiptToPdf("receipt-print-area", "preview")}
              >
                Preview PDF
              </button>
              <button
                className="flex-1 h-10 bg-blue-600 text-white rounded-full"
                onClick={handlePrint}
              >
                Print
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reprint */}
      {reprintAskOpen && (
        <Modal onClose={() => setReprintAskOpen(false)}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Print Again?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Apakah Anda ingin mencetak salinan struk tambahan?
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 h-10 border rounded-full"
                onClick={() => setReprintAskOpen(false)}
              >
                No
              </button>
              <button
                className="flex-1 h-10 bg-blue-600 text-white rounded-full"
                onClick={() => printNodeById("receipt-print-area")}
              >
                Yes, Print Again
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =======================
   Modal (inline)
   ======================= */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[min(560px,92vw)]">
        {children}
      </div>
    </div>
  );
}
