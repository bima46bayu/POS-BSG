import React, { useCallback } from "react";

// ...
const handlePayment = useCallback(
  ({
    payment_method,
    paid_amount,
    customer_name,
    note,
    reference,
    // datang dari <Payment />
    discount_type,
    discount_value,
    discount_amount,
    total, // grand total dari Payment (boleh tidak dikirim)
  }) => {
    if (!items.length) {
      alert("Cart is empty.");
      return;
    }

    const subtotalCalc = subtotalSafe; // dari memo di SaleSubmitter
    const taxCalc = taxSafe;           // dari memo di SaleSubmitter
    const discountCalc = Number(discount_amount || 0);

    // pakai total dari child jika ada; fallback hitung di sini
    const finalTotal =
      typeof total === "number"
        ? total
        : Math.max(0, subtotalCalc + taxCalc - discountCalc);

    if (payment_method === "cash" && Number(paid_amount) < finalTotal) {
      alert("Cash received is less than total.");
      return;
    }

    const payload = {
      customer_name: customer_name || null,
      subtotal: subtotalCalc,
      discount: discountCalc,   // rupiah
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
      payments: [
        {
          method: payment_method, // cash|card|ewallet|transfer|qris
          amount: Number(paid_amount || 0),
          reference: reference || null,
        },
      ],
      note,
      // opsional simpan raw pilihan diskon
      discount_type: discount_type || null,
      discount_value: Number(discount_value || 0),
    };

    saleMutation.mutate(payload);
  },
  [items, subtotalSafe, taxSafe, saleMutation]
);
