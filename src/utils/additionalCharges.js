const CHARGE_ORDER = { SERVICE: 0, PB1: 1 };

/**
 * Service Charge applies on chargeBase (after item + transaction discounts).
 * PB1 applies on chargeBase + Service Charge amount.
 */
export function computeAdditionalCharges(chargeBase, additionalCharges = []) {
  const base = Math.max(0, Number(chargeBase || 0));

  const sorted = [...additionalCharges]
    .filter((c) => c.is_active)
    .sort(
      (a, b) =>
        (CHARGE_ORDER[a.type] ?? 9) - (CHARGE_ORDER[b.type] ?? 9)
    );

  let serviceAmount = 0;
  const computed = [];

  for (const c of sorted) {
    const calcBase = c.type === "PB1" ? base + serviceAmount : base;
    const raw =
      c.calc_type === "PERCENT"
        ? (calcBase * Number(c.value || 0)) / 100
        : Number(c.value || 0);
    const amount = Math.max(0, Math.round(raw * 100) / 100);

    if (c.type === "SERVICE") {
      serviceAmount = amount;
    }

    computed.push({
      ...c,
      base: calcBase,
      amount,
    });
  }

  const total = computed.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  return { computed, total };
}
