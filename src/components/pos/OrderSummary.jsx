import React, { useMemo } from "react";

export default function OrderSummary({
  items = [],
  subtotal,       // number | undefined
  tax = 0,        // number (rupiah)
  discount = 0,   // number (rupiah)
  total,          // number | undefined (jika tak ada, dihitung)
  taxRate = 0.11, // Untuk label "Tax (11%)"
}) {
  // Hitung subtotal dari items bila prop subtotal tidak diberikan
  const itemsSubtotal = useMemo(() => {
    if (typeof subtotal === "number") return subtotal;
    return items.reduce(
      (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
      0
    );
  }, [items, subtotal]);

  // Hitung grand total bila prop total tidak diberikan
  const grandTotal = useMemo(() => {
    if (typeof total === "number") return total;
    return Math.max(0, Number(itemsSubtotal) + Number(tax || 0) - Number(discount || 0));
  }, [total, itemsSubtotal, tax, discount]);

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h3>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Subtotal</span>
        <span className="text-gray-500">
          Rp{Number(itemsSubtotal).toLocaleString("id-ID")}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm mt-1">
        <span className="text-gray-500">Tax ({Math.round(taxRate * 100)}%)</span>
        <span className="text-gray-500">
          Rp{Number(tax).toLocaleString("id-ID")}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm mt-1">
        <span className="text-gray-500">Discount</span>
        <span className={Number(discount) ? "text-red-600 font-medium" : "text-gray-400"}>
          -Rp{Number(discount || 0).toLocaleString("id-ID")}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm mt-4">
        <span className="text-gray-500">Total</span>
        <span className="font-semibold text-blue-600">
          Rp{Number(grandTotal).toLocaleString("id-ID")}
        </span>
      </div>
    </div>
  );
}
