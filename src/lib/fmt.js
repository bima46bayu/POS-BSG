// src/lib/fmt.js
export const IDR = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

export const N = (v) =>
  v == null ? 0 : Number(String(v).replace(/[^0-9.-]/g, "")) || 0;

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
