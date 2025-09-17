const handlePayment = useCallback(
  ({ payment_method, paid_amount, customer_name, note, reference }) => {
    if (cartItems.length === 0) return alert("Cart kosong.");

    const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = 0;
    const tax = 0; // sesuaikan kalau perlu
    const total = subtotal - discount + tax;

    if (payment_method === "cash" && Number(paid_amount) < Number(total)) {
      return alert("Uang tunai kurang.");
    }

    const items = cartItems.map((i) => ({
      product_id: i.id,
      price: i.price,
      qty: i.quantity,
      subtotal: i.price * i.quantity,
    }));

    const payload = {
      // cashier_id: 1, // kalau BE ambil dari token, hapus saja
      customer_name: customer_name || null,
      subtotal,
      discount,
      tax,
      total,
      paid: Number(paid_amount || 0),
      change: Math.max(0, Number(paid_amount || 0) - total),
      status: "completed",
      items,
      payments: [
        { method: payment_method, amount: Number(paid_amount || 0), reference: reference || null },
      ],
      note,
    };

    saleMutation.mutate(payload);
  },
  [cartItems, saleMutation]
);
