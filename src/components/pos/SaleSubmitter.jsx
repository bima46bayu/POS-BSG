import React, { useMemo, useCallback, useState } from "react";
import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReceiptTicket from "../ReceiptTicket";
import toast from "react-hot-toast";

// ==== print helper: print node by id ====
function printNodeById(id = "receipt-print-area") {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open("", "_blank", "noopener,noreferrer,width=480");
  if (!w) return;
  w.document.open();
  w.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 6mm; }
          body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
        </style>
      </head>
      <body>${el.innerHTML}</body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

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
        : items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0),
    [items, subtotal]
  );
  const taxSafe = useMemo(() => (typeof tax === "number" ? tax : 0), [tax]);

  // Sinkron dari <Payment/> agar OrderSummary bisa tampil Discount + Total
  const [discountAmount, setDiscountAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(subtotalSafe + taxSafe);

  // ===== Popup states =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null); // payload dari Payment sebelum konfirmasi
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reprintAskOpen, setReprintAskOpen] = useState(false);
  const [saleId, setSaleId] = useState(null); // ID untuk ReceiptTicket (GET /sales/:id)

  const queryClient = useQueryClient();
  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      // Patch stok cache "products"
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
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });

      // ambil id sale dari response createSale (sesuai payload API-mu)
      const createdId =
        res?.id ?? res?.sale_id ?? res?.data?.id ?? null;
      setSaleId(createdId);

      // buka popup struk, tutup konfirmasi
      setReceiptOpen(true);
      setConfirmOpen(false);

      onSuccess?.(res);
    },
  });

  // STEP 1: dari Payment → tampilkan konfirmasi (jangan langsung mutate)
  const handlePayment = useCallback(
    (payloadFromPayment) => {
      if (!items.length) return toast.error("Cart is empty.");
      setPendingPayment(payloadFromPayment);
      setConfirmOpen(true);
    },
    [items]
  );

  // STEP 2: user klik "Ya, Bayar" → jalankan mutasi
  const confirmAndSubmit = () => {
    const p = pendingPayment;
    if (!p) return;

    // Hitung subtotal dari items (pakai diskon per-item)
    let subtotalCalc = 0;
    const itemsPayload = items.map((i) => {
      const price = Number(i.price || 0);
      const type  = i.discount_type || 'rp';
      const val   = Number(i.discount_value || 0);
      const discNominal = Math.min(price, type === '%' ? (price * val) / 100 : val); // per unit
      const net   = Math.max(0, price - discNominal);
      const qty   = Number(i.quantity || 0);
      subtotalCalc += net * qty;

      return {
        product_id: i.product_id ?? i.id,
        qty,
        unit_price: price,
        discount_nominal: Math.round(discNominal * 100) / 100, // per unit
      };
    });

    const taxCalc = Number(taxSafe || 0);
    const discountHeader = Number(p.discount_amount || 0);
    const totalCalc = typeof p.total === "number"
      ? p.total
      : Math.max(0, subtotalCalc - discountHeader + taxCalc);

    if (p.payment_method === "cash" && Number(p.paid_amount) < totalCalc) {
      return toast.error("Cash received is less than total.");
    }

    const payload = {
      customer_name: p.customer_name || null,

      // header ringkasan
      discount: Math.round(discountHeader * 100) / 100,      // Rp (header)
      service_charge: 0,                                     // belum ada UI → set 0
      tax: Math.round(taxCalc * 100) / 100,                  // kirim nominal (atau kirim tax_percent kalau kamu pakai %)
      // NOTE: 'subtotal' & 'total' akan dihitung ulang di server; tidak wajib dikirim.

      items: itemsPayload,
      payments: [{
        method: p.payment_method === "qris" ? "QRIS" : p.payment_method, // guard
        amount: Math.round(Number(p.paid_amount || 0) * 100) / 100,
        reference: p.reference || null,
      }],
      note: p.note || null,

      // info audit opsional
      discount_type: p.discount_type || null,
      discount_value: Number(p.discount_value || 0),
    };

    // kirim
    saleMutation.mutate(payload);
  };


  // STEP 3: cetak & tawarkan reprint
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
        onPayment={handlePayment} // → konfirmasi dulu
        onCancel={onCancel}
        loading={saleMutation.isLoading}
        onSummaryChange={({ discountAmount, total }) => {
          setDiscountAmount(discountAmount);
          setGrandTotal(total);
        }}
      />

      {/* ===== Popup Konfirmasi ===== */}
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
              >
                Ya, Bayar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Popup Struk (ambil data via API by saleId) ===== */}
      {receiptOpen && (
        <Modal onClose={() => setReceiptOpen(false)}>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Transaction Success</h3>

            {/* Struk dari API: GET api/sales/:id */}
            <ReceiptTicket
              saleId={saleId}
              store={{
                name: "INSTAFACTORY",
                address: "Taman Tekno BSD City, Sektor XI No.56 Blok A2, Setu, Kec. Setu, Kota Tangerang Selatan, Banten 15314",
                phone: "0812-3456-7890",
              }}
            />

            <div className="flex gap-2 mt-3">
              <button
                className="flex-1 h-10 border rounded-full"
                onClick={() => setReceiptOpen(false)}
              >
                Close
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

      {/* ===== Popup Reprint? ===== */}
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
                onClick={() => {
                  printNodeById("receipt-print-area");
                }}
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

// ==== Modal minimalis (tanpa lib, pakai Tailwind) ====
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
