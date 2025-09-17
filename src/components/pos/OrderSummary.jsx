import React, { useMemo } from "react";

export default function OrderSummary({
  items = [],
  subtotal,          // optional: subtotal sebelum pajak
  tax = 0,           // pajak (angka rupiah)
  total,             // optional: subtotal + tax
  taxRate = 0.11,    // untuk label "Tax (11%)"
}) {
  // fallback kalau subtotal/total tidak dikirim dari parent
  const itemsSubtotal = useMemo(
    () => (typeof subtotal === "number"
      ? subtotal
      : items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)),
    [items, subtotal]
  );
  const grandTotal = useMemo(
    () => (typeof total === "number" ? total : itemsSubtotal + Number(tax || 0)),
    [total, itemsSubtotal, tax]
  );

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
        <span className="text-gray-500">
          Tax ({Math.round(taxRate * 100)}%)
        </span>
        <span className="text-gray-500">
          Rp{Number(tax).toLocaleString("id-ID")}
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
