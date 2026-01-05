import React, { useMemo } from "react";

const money = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function OrderSummary({
  items = [],
  discount = 0,     // preview discount dari Payment (GLOBAL)
  tax = 0,          // Rp
  subtotal,         // optional override
  total,            // optional override
}) {
  // Subtotal kotor (tanpa diskon apapun)
  const itemsGross = useMemo(() => {
    return items.reduce(
      (sum, it) =>
        sum + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
  }, [items]);

  // Total diskon dari ITEM (akumulasi per baris)
  const itemDiscountTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.quantity || 0);
      const type = it.discount_type || "%";
      const val = Number(it.discount_value || 0);

      if (!val || qty <= 0) return sum;

      const perUnitDiscount =
        type === "%"
          ? (price * val) / 100
          : val;

      const safeDiscount = Math.min(price, perUnitDiscount);

      return sum + safeDiscount * qty;
    }, 0);
  }, [items]);

  const shownSubtotal =
    typeof subtotal === "number" ? subtotal : itemsGross;

  const shownTotal = useMemo(() => {
    if (typeof total === "number") return total;
    return Math.max(
      0,
      shownSubtotal - itemDiscountTotal - Number(discount || 0) + Number(tax || 0)
    );
  }, [shownSubtotal, discount, tax, total]);

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Order Summary
      </h3>

      <Row label="Subtotal Item" value={itemsGross} />

      <Row
        label="Item Discount"
        value={-itemDiscountTotal}
        red
      />

      <Row
        label="Discount Transaction"
        value={-Number(discount || 0)}
        red
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-gray-600">Total</span>
        <span className="text-2xl font-bold text-blue-600">
          {money(shownTotal)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, red, muted, bold, note }) {
  return (
    <div className="flex items-center justify-between text-sm mt-1">
      <span className={muted ? "text-gray-400" : "text-gray-500"}>
        {label}
        {note && (
          <span className="ml-1 text-[11px] italic text-gray-400">
            ({note})
          </span>
        )}
      </span>
      <span
        className={`${red ? "text-red-600" : "text-gray-700"} ${
          bold ? "font-semibold" : ""
        }`}
      >
        {money(value)}
      </span>
    </div>
  );
}
