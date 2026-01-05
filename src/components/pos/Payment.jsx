import React, { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Wallet,
  Banknote,
  QrCode,
  ChevronDown,
  Landmark,
} from "lucide-react";

const METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "ewallet", label: "E-Wallet", icon: Wallet },
  { value: "transfer", label: "Bank Transfer", icon: Landmark },
  { value: "QRIS", label: "QRIS", icon: QrCode },
];

export default function Payment({
  subtotal,
  tax,
  globalDiscounts = [],   // ✅ DARI PARENT
  onPayment,
  onCancel,
  loading,
  onSummaryChange,
}) {
  const [method, setMethod] = useState("cash");
  const [customer, setCustomer] = useState("General");
  const [paid, setPaid] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  /* ===== GLOBAL DISCOUNT ===== */
  const [globalDiscountId, setGlobalDiscountId] = useState(null);

  const selectedDiscount = useMemo(
    () => globalDiscounts.find((d) => d.id === globalDiscountId),
    [globalDiscounts, globalDiscountId]
  );

  /* ===== PREVIEW DISCOUNT (FE ONLY) ===== */
  const discountPreview = useMemo(() => {
    if (!selectedDiscount) return 0;

    let amount =
      selectedDiscount.kind === "PERCENT"
        ? (Number(subtotal || 0) * selectedDiscount.value) / 100
        : Number(selectedDiscount.value || 0);

    if (selectedDiscount.max_amount != null) {
      amount = Math.min(amount, Number(selectedDiscount.max_amount));
    }

    return Math.max(0, Math.round(amount));
  }, [selectedDiscount, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(
      0,
      Number(subtotal || 0) + Number(tax || 0) - discountPreview
    );
  }, [subtotal, tax, discountPreview]);

  /* ===== BROADCAST KE ORDER SUMMARY ===== */
  useEffect(() => {
    onSummaryChange?.({
      discountAmount: discountPreview,
      total: grandTotal,
    });
  }, [discountPreview, grandTotal, onSummaryChange]);

  /* ===== AUTO FILL PAID UNTUK NON-CASH ===== */
  useEffect(() => {
    if (method !== "cash") setPaid(String(grandTotal || 0));
  }, [method, grandTotal]);

  const change = useMemo(() => {
    if (method !== "cash") return 0;
    return Math.max(0, Number(paid || 0) - grandTotal);
  }, [paid, grandTotal, method]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (grandTotal <= 0) return false;
    if (method === "cash") return Number(paid) >= grandTotal;
    return true;
  }, [loading, method, paid, grandTotal]);

  const submit = () => {
    onPayment?.({
      payment_method: method,
      paid_amount: Number(paid || 0),
      reference: reference?.trim() || null,
      customer_name: customer || null,
      note,
      global_discount_id: globalDiscountId, // 🔑 backend source of truth
      total_preview: grandTotal,            // FE preview only
    });
  };

  const CurrentIcon =
    METHODS.find((m) => m.value === method)?.icon || Banknote;

  return (
    <div className="mt-4 border-t pt-4">
      {/* GLOBAL DISCOUNT */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Discount Transaction
      </label>

      <div className="relative">
        <select
          value={globalDiscountId || ""}
          onChange={(e) =>
            setGlobalDiscountId(
              e.target.value ? Number(e.target.value) : null
            )
          }
          className="w-full h-11 appearance-none rounded-full border px-4 pr-9
                     text-sm bg-white border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Discount</option>
          {globalDiscounts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2
                     -translate-y-1/2 h-4 w-4 text-gray-400"
        />
      </div>

      {selectedDiscount && (
        <div className="mt-1 text-xs text-blue-600">
          Promo applied (preview): −Rp
          {discountPreview.toLocaleString("id-ID")}
        </div>
      )}

      {/* CUSTOMER */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Type (optional)
        </label>
        <div className="relative">
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2
                       -translate-y-1/2 h-4 w-4 text-gray-400"
          />
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full h-11 appearance-none rounded-full border px-4 pr-9
                       text-sm bg-white border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="General">General</option>
            <option value="Retail">Retail</option>
            <option value="Corporate">Corporate</option>
            <option value="Influencer">Influencer</option>
            <option value="Member">Member</option>
            <option value="Marketplace">Marketplace</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* PAYMENT METHOD */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Method
        </label>
        <div className="relative">
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2
                       -translate-y-1/2 h-4 w-4 text-gray-400"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-11 appearance-none rounded-full border px-4 pr-9
                       text-sm bg-white border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <CurrentIcon className="h-4 w-4" />
          <span>{METHODS.find((m) => m.value === method)?.label}</span>
        </div>
      </div>

      {/* RECEIVED */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Received (IDR)
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          className="w-full h-11 rounded-full border px-4 text-sm
                     border-gray-300 focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
          placeholder="Enter amount"
        />
        {method === "cash" && (
          <div className="flex items-center justify-between mt-1 text-sm">
            <span className="text-gray-500">Change</span>
            <span className="font-semibold">
              Rp{change.toLocaleString("id-ID")}
            </span>
          </div>
        )}
        {method === "cash" && paid && Number(paid) < grandTotal && (
          <div className="text-red-600 text-xs mt-1">
            Cash received is less than total.
          </div>
        )}
      </div>

      {/* NOTE */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded-2xl px-4 py-2 text-sm
                     border-gray-300 focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
          placeholder="Transaction note…"
        />
      </div>

      {/* ACTIONS */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 border border-gray-300 rounded-full
                     text-sm hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 h-11 bg-blue-600 text-white rounded-full
                     text-sm font-semibold hover:bg-blue-700
                     disabled:opacity-60"
          disabled={!canSubmit}
        >
          {loading ? "Processing…" : "Pay"}
        </button>
      </div>
    </div>
  );
}
