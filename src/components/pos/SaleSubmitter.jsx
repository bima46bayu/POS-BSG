import React, { useMemo, useCallback, useState } from "react";
import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function SaleSubmitter({
  items = [],
  subtotal,
  tax,
  total,                 // (tidak dipakai lagi, biar Payment yang hitung)
  onSuccess,
  onCancel,
  showSummary = true,
}) {
  const subtotalSafe = useMemo(
    () => (typeof subtotal === "number" ? subtotal : items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)),
    [items, subtotal]
  );
  const taxSafe = useMemo(() => (typeof tax === "number" ? tax : 0), [tax]);

  // NEW: sinkron data summary dari Payment
  const [discountAmount, setDiscountAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(subtotalSafe + taxSafe);

  const queryClient = useQueryClient();
  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      queryClient.setQueriesData({ queryKey: ["products"] }, (old) => {
        if (!old) return old;
        const sold = new Map((Array.isArray(res?.items) ? res.items : []).map(it => [it.product_id, Number(it.qty || 0)]));
        const patchPage = (page) => {
          const items = Array.isArray(page?.items) ? page.items : [];
          const patched = items.map(p => {
            const dec = sold.get(p.id) || 0;
            const current = Number(p.stock ?? p.qty ?? p.quantity ?? 0);
            return dec ? { ...p, stock: Math.max(0, current - dec) } : p;
          });
          return { ...page, items: patched };
        };
        return old.pages ? { ...old, pages: old.pages.map(patchPage) } : patchPage(old);
      });
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });
      onSuccess?.(res);
    },
  });

  const handlePayment = useCallback(
    ({
      payment_method, paid_amount, customer_name, note, reference,
      discount_type, discount_value, discount_amount, total, // dari Payment
    }) => {
      if (!items.length) return alert("Cart is empty.");

      const subtotalCalc = subtotalSafe;
      const taxCalc = taxSafe;
      const discountCalc = Number(discount_amount || 0);
      const finalTotal = typeof total === "number" ? total : Math.max(0, subtotalCalc + taxCalc - discountCalc);

      if (payment_method === "cash" && Number(paid_amount) < finalTotal) {
        return alert("Cash received is less than total.");
      }

      const payload = {
        customer_name: customer_name || null,
        subtotal: subtotalCalc,
        discount: discountCalc,  // rupiah
        tax: taxCalc,
        total: finalTotal,
        paid: Number(paid_amount || 0),
        change: Math.max(0, Number(paid_amount || 0) - finalTotal),
        status: "completed",
        items: items.map((i) => ({
          product_id: i.id,
          price: i.price,
          qty: i.quantity,
          subtotal: i.price * i.quantity,
        })),
        payments: [{ method: payment_method, amount: Number(paid_amount || 0), reference: reference || null }],
        note,
        // opsional simpan raw choice
        discount_type: discount_type || null,
        discount_value: Number(discount_value || 0),
      };

      saleMutation.mutate(payload);
    },
    [items, subtotalSafe, taxSafe, saleMutation]
  );

  return (
    <div>
      {showSummary && (
        <OrderSummary
          items={items}
          subtotal={subtotalSafe}
          tax={taxSafe}
          discount={discountAmount}     // NEW: tampilkan baris diskon
          total={grandTotal}            // NEW: total sesudah diskon
          taxRate={0.11}
        />
      )}

      <Payment
        subtotal={subtotalSafe}
        tax={taxSafe}
        onPayment={handlePayment}
        onCancel={onCancel}
        loading={saleMutation.isLoading}
        onSummaryChange={({ discountAmount, total }) => {  // NEW: sinkron dari Payment
          setDiscountAmount(discountAmount);
          setGrandTotal(total);
        }}
      />
    </div>
  );
}
