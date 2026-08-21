// src/lib/fmt.js

// Money formatting comes in three flavours across the app. They render
// differently, so they are separate exports rather than one "correct" one:
//
//   IDR(1000)      -> "Rp 1.000"  (locale currency style; most screens)
//   rupiah(1000)   -> "Rp 1.000"  (manual prefix; same visual result)
//   IDRPlain(1000) -> "1.000"     (digits only; payment-request + GR pages)
//
// Prefer IDR for new code.
export const IDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

/** Digits only, no currency symbol, no decimals. */
export const IDRPlain = (n) =>
  Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/**
 * Manual "Rp" prefix. Pass { space: false } for the compact POS variant
 * ("Rp1.000") used where horizontal room is tight.
 */
export const rupiah = (n, { space = true } = {}) =>
  `Rp${space ? " " : ""}${Number(n || 0).toLocaleString("id-ID")}`;

export const N = (v) =>
  v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")) || 0;

/**
 * Numeric value for a form <input>, with pointless trailing zeros removed.
 *
 * MySQL hands back DECIMAL columns as padded strings — `price` becomes
 * "100.00" and `pack_size` becomes "100.0000" — so edit forms were showing
 * noise like "5000.00" where the user only ever typed 5000. Significant
 * decimals survive ("0.50" -> "0.5", "1.5" -> "1.5"); only the padding goes.
 *
 * Returns "" for null/blank so an unknown value stays an empty field rather
 * than becoming a 0 that looks deliberately entered.
 */
export const numInput = (v) => {
  if (v === null || v === undefined || v === "") return "";

  const n = Number(v);
  // Non-numeric input is passed through untouched rather than blanked, so a
  // bad value stays visible and fixable instead of silently disappearing.
  if (!Number.isFinite(n)) return String(v);

  // Number->String would switch to exponent notation past 1e21, which is not a
  // valid <input type="number"> value.
  return Math.abs(n) >= 1e21 ? String(v) : String(n);
};

export const shortIDR = (v) =>
  v >= 1e9 ? (v / 1e9).toFixed(1) + "M"
  : v >= 1e6 ? (v / 1e6).toFixed(1) + "jt"
  : v >= 1e3 ? (v / 1e3).toFixed(1) + "rb"
  : String(v);

export const dayKey = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export const formatDate = (d) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};

export const generateDateRange = (from, to) => {
  const dates = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T23:59:59");
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    dates.push(dayKey(dt));
  }
  return dates;
};

export const PIE_COLORS = [
  "#2563EB","#7C3AED","#EC4899","#10B981",
  "#F59E0B","#EF4444","#06B6D4","#8B5CF6"
];

export const isDiscountItem = (it) =>
  N(it?.discount_nominal) > 0 || N(it?.discount_percent) > 0;

export const isDiscountSale = (s) =>
  N(s?.discount) > 0 || (Array.isArray(s?.items) && s.items.some(isDiscountItem));

// ====== (NEW) Payment helpers ======
export const normMethodKey = (m) => (m === "QRIS" ? "QRIS" : String(m || "").toLowerCase());

export const methodLabel = (k) => {
  if (k === "QRIS") return "QRIS";
  if (k === "ewallet") return "E-Wallet";
  if (k === "transfer") return "Bank Transfer";
  if (!k) return "-";
  return k.charAt(0).toUpperCase() + k.slice(1);
};

export const payBadgeClass = (method) => {
  const k = normMethodKey(method);
  switch (k) {
    case "cash": return "bg-green-100 text-green-800 border-green-200";
    case "card": return "bg-blue-100 text-blue-800 border-blue-200";
    case "ewallet": return "bg-purple-100 text-purple-800 border-purple-200";
    case "transfer": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "QRIS": return "bg-orange-100 text-orange-800 border-orange-200";
    default: return "bg-slate-100 text-slate-800 border-slate-200";
  }
};
