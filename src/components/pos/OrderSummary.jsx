import React, { useMemo } from "react";

const money = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function OrderSummary({
  items = [],
  discount = 0, // transaction discount ONLY
  additionalCharges = [], // PB1 & SERVICE
  subtotal, // 🔥 SUDAH NET ITEM DISCOUNT
  total,
}) {
  /* ================= GROSS ITEM (DISPLAY ONLY) ================= */
  const itemsGross = useMemo(() => {
    return items.reduce(
      (sum, it) =>
        sum + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
  }, [items]);

  /* ================= ITEM DISCOUNT (DISPLAY ONLY) ================= */
  const itemDiscountTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.quantity || 0);
      const type = it.discount_type || "%";
      const val = Number(it.discount_value || 0);

      if (!val || qty <= 0) return sum;

      const perUnit =
        type === "%"
          ? (price * val) / 100
          : val;

      return sum + Math.min(price, perUnit) * qty;
    }, 0);
  }, [items]);

  /* ================= BASE FOR CHARGE (🔥 FIXED) ================= */
  const chargeBase = useMemo(() => {
    // ❗ subtotal sudah NET item discount
    return Math.max(
      0,
      Number(subtotal || 0) - Number(discount || 0)
    );
  }, [subtotal, discount]);

  /* ================= ADDITIONAL CHARGES ================= */
  const computedCharges = useMemo(() => {
    return additionalCharges
      .filter((c) => c.is_active)
      .map((c) => {
        const amount =
          c.calc_type === "PERCENT"
            ? (chargeBase * Number(c.value || 0)) / 100
            : Number(c.value || 0);

        return {
          ...c,
          amount: Math.max(0, amount),
        };
      });
  }, [additionalCharges, chargeBase]);

  const totalAdditionalCharge = useMemo(() => {
    return computedCharges.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0
    );
  }, [computedCharges]);

  /* ================= GRAND TOTAL ================= */
  const shownTotal = useMemo(() => {
    if (typeof total === "number") return total;

    return Math.max(
      0,
      chargeBase + totalAdditionalCharge
    );
  }, [total, chargeBase, totalAdditionalCharge]);

  /* ================= RENDER ================= */
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

      {computedCharges.map((c) => (
        <Row
          key={c.type}
          label={c.type === "PB1" ? "PB1" : "Service Charge"}
          value={c.amount}
          note={
            c.calc_type === "PERCENT"
              ? `${c.value}%`
              : "Fixed"
          }
        />
      ))}

      <div className="border-t mt-3 pt-3 flex items-center justify-between">
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
