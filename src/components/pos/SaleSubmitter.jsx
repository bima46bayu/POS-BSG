import React, { useMemo, useCallback } from "react";
import { createSale } from "../../api/sales";
import OrderSummary from "./OrderSummary";
import Payment from "./Payment";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Props:
 * - items: [{ id, name, price, quantity }]
 * - subtotal, tax, total: number  (wajib dipass dari parent biar konsisten)
 * - onSuccess(res)
 * - onCancel()
 * - showSummary: boolean
 */
export default function SaleSubmitter({
  items = [],
  subtotal,
  tax,
  total,
  onSuccess,
  onCancel,
  showSummary = true,
}) {
  // fallback kecil kalau parent lupa pass (tetap aman)
  const subtotalSafe = useMemo(
    () => (typeof subtotal === "number" ? subtotal : items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)),
    [items, subtotal]
  );
  const taxSafe = useMemo(() => (typeof tax === "number" ? tax : 0), [tax]);
  const totalSafe = useMemo(
    () => (typeof total === "number" ? total : subtotalSafe + taxSafe),
    [total, subtotalSafe, taxSafe]
  );

  const queryClient = useQueryClient();
  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      // 1) Instan: patch stok di semua cache "products"
      queryClient.setQueriesData({ queryKey: ["products"] }, (old) => {
        if (!old) return old;
        const sold = new Map(
          (Array.isArray(res?.items) ? res.items : []).map(it => [it.product_id, Number(it.qty || 0)])
        );
        const patchPage = (page) => {
          const items = Array.isArray(page?.items) ? page.items : [];
          const patched = items.map(p => {
            const dec = sold.get(p.id) || 0;
            if (!dec) return p;
            const current = Number(p.stock ?? p.qty ?? p.quantity ?? 0);
            return { ...p, stock: Math.max(0, current - dec) };
          });
          return { ...page, items: patched };
        };
        return old.pages ? { ...old, pages: old.pages.map(patchPage) } : patchPage(old);
      });

      // 2) Sinkron: refetch background agar pasti sesuai backend
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });

      // lanjutkan flow suksesmu (clear cart, tutup sheet, dll.)
      onSuccess?.(res);
    },
  });

  const handlePayment = useCallback(
    ({ payment_method, paid_amount, customer_name, note, reference }) => {
      if (!items.length) {
        alert("Cart is empty.");
        return;
      }
      if (payment_method === "cash" && Number(paid_amount) < Number(totalSafe)) {
        alert("Cash received is less than total.");
        return;
      }

      const payload = {
        customer_name: customer_name || null,
        subtotal: subtotalSafe,
        discount: 0,
        tax: taxSafe,
        total: totalSafe,
        paid: Number(paid_amount || 0),
        change: Math.max(0, Number(paid_amount || 0) - totalSafe),
        status: "completed",
        items: items.map((i) => ({
          product_id: i.id,
          price: i.price,
          qty: i.quantity,
          subtotal: i.price * i.quantity,
        })),
        payments: [
          {
            method: payment_method,                 // cash|card|ewallet|transfer|qris
            amount: Number(paid_amount || 0),
            reference: reference || null,
          },
        ],
        note,
      };

      saleMutation.mutate(payload);
    },
    [items, subtotalSafe, taxSafe, totalSafe, saleMutation]
  );

  return (
    <div>
      {showSummary && <OrderSummary items={items} tax={taxSafe} />}
      <Payment
        subtotal={subtotalSafe}
        tax={taxSafe}
        total={totalSafe}
        onPayment={handlePayment}
        onCancel={onCancel}
        loading={saleMutation.isLoading}
      />
    </div>
  );
}
