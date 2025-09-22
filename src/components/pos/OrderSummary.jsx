// OrderSummary.jsx (drop-in)
import React, { useMemo } from "react";

const money = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function OrderSummary({
  items = [],
  discount: discountHeader = 0,   // Rp (diskon header)
  tax = 0,                        // Rp
  taxRate = 0,                    // label saja
  subtotal,                       // optional override
  total,                          // optional override
}) {
  const { itemsGross, itemDiscountTotal, itemsNetSubtotal } = useMemo(() => {
    let gross = 0, discItems = 0;
    for (const it of items) {
      const price = Number(it.price || 0);
      const qty   = Number(it.quantity || 0);
      const type  = it.discount_type || "rp"; // 'rp' | '%'
      const val   = Number(it.discount_value || 0);
      const discPerUnit = Math.min(price, type === "%" ? (price * val) / 100 : val);
      gross     += price * qty;
      discItems += discPerUnit * qty;
    }
    return {
      itemsGross: gross,
      itemDiscountTotal: discItems,
      itemsNetSubtotal: Math.max(0, gross - discItems),
    };
  }, [items]);

  const shownSubtotal = typeof subtotal === "number" ? subtotal : itemsNetSubtotal;
  const headerDisc = Number(discountHeader || 0);
  const grandDiscount = itemDiscountTotal + headerDisc;

  const grandTotal = useMemo(() => {
    if (typeof total === "number") return total;
    return Math.max(0, shownSubtotal - headerDisc + Number(tax || 0));
  }, [total, shownSubtotal, headerDisc, tax]);

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h3>

      <Row label="Subtotal Item" value={itemsGross} />
      <Row label="Item Discount" value={-itemDiscountTotal} red />
      {/* <Row label="Subtotal (net)" value={shownSubtotal} /> */}
      {/* <Row label={`Tax${taxRate ? ` (${Math.round(taxRate * 100)}%)` : ""}`} value={tax} /> */}
      <Row label="Discount Transaction" value={-headerDisc} red />

      {/* GRAND DISCOUNT (Item + Header) */}
      {/* <Row label="Grand Discount" value={-grandDiscount} red /> */}

      {/* GRAND TOTAL besar */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-gray-600">Total</span>
        <span className="text-2xl font-bold text-blue-600">
          {money(grandTotal)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, red, muted, bold }) {
  const n = Number(value || 0);
  return (
    <div className="flex items-center justify-between text-sm mt-1">
      <span className={muted ? "text-gray-400" : "text-gray-500"}>{label}</span>
      <span className={`${red ? "text-red-600" : "text-gray-700"} ${bold ? "font-semibold" : ""}`}>
        {money(n)}
      </span>
    </div>
  );
}
