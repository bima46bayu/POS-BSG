import React, { useEffect, useMemo, useState } from "react";
import { CreditCard, Wallet, Banknote, QrCode, ChevronDown, Landmark } from "lucide-react";

const METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "ewallet", label: "E-Wallet", icon: Wallet },
  { value: "transfer", label: "Bank Transfer", icon: Landmark },
  { value: "QRIS", label: "QRIS", icon: QrCode },
];

/**
 * Props:
 * - subtotal: number
 * - tax: number
 * - onPayment(payload)
 * - onCancel()
 * - loading: boolean
 * - onSummaryChange?: ({ discountAmount, total }) => void   // NEW
 */
export default function Payment({ subtotal, tax, onPayment, onCancel, loading, onSummaryChange }) {
  const [method, setMethod] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [paid, setPaid] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  // Discount state
  const [discountType, setDiscountType] = useState("");   // "percent" | "amount" | ""
  const [discountValue, setDiscountValue] = useState(""); // string

  // Hitung diskon (Rp) dari subtotal
  const discountAmount = useMemo(() => {
    const dv = Number(discountValue) || 0;
    if (!discountType) return 0;
    if (discountType === "percent") {
      const pct = Math.min(Math.max(dv, 0), 100);
      return Math.round(Number(subtotal || 0) * pct / 100);
    }
    return Math.min(Math.max(dv, 0), Number(subtotal || 0));
  }, [discountType, discountValue, subtotal]);

  // Total akhir
  const grandTotal = useMemo(() => {
    return Math.max(0, Number(subtotal || 0) + Number(tax || 0) - discountAmount);
  }, [subtotal, tax, discountAmount]);

  // Broadcast ke parent biar OrderSummary ikut update
  useEffect(() => {
    onSummaryChange?.({ discountAmount, total: grandTotal });
  }, [discountAmount, grandTotal, onSummaryChange]);

  // Auto-fill paid untuk non-cash
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
      // kirim info diskon + total fix
      discount_type: discountType || null,
      discount_value: Number(discountValue || 0),
      discount_amount: discountAmount,
      total: grandTotal,
    });
  };

  const CurrentIcon = METHODS.find((m) => m.value === method)?.icon || Banknote;

  return (
    <div className="mt-4 border-t pt-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
      {/* Discount inline pill */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={discountType}
            onChange={(e) => { setDiscountType(e.target.value); if (!e.target.value) setDiscountValue(""); }}
            className={`
              h-11 min-w-[100px] appearance-none rounded-full border px-4 pr-9 text-sm font-medium
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${discountType ? "border-blue-500 text-blue-600 bg-white" : "border-gray-300 text-gray-400 bg-gray-50"}
            `}
          >
            {/* <option value="">Type</option> */}
            <option value="percent">%</option>
            <option value="amount">Rp</option>
          </select>
          <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 ${discountType ? "text-blue-500" : "text-gray-400"}`} />
        </div>

        <div className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "percent" ? "Discount %" : "Discount amount"}
            className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Customer */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type (optional)</label>
        <div className="relative">
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full h-11 appearance-none border rounded-full px-4 pr-9 text-sm bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* <option value="">-- Select Customer Type --</option> */}
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

      {/* Payment Method */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
        <div className="relative">
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-11 appearance-none border rounded-full px-4 pr-9 text-sm bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <CurrentIcon className="h-4 w-4" />
          <span>{METHODS.find((m) => m.value === method)?.label}</span>
        </div>
      </div>

      {/* Received */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Received (IDR)</label>
        <input
          type="number"
          inputMode="numeric"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter amount"
        />
        {method === "cash" && (
          <div className="flex items-center justify-between mt-1 text-sm">
            <span className="text-gray-500">Change</span>
            <span className="font-semibold">Rp{change.toLocaleString("id-ID")}</span>
          </div>
        )}
        {method === "cash" && paid && Number(paid) < grandTotal && (
          <div className="text-red-600 text-xs mt-1">Cash received is less than total.</div>
        )}
      </div>

      {/* Reference (non-cash) */}
      {method !== "cash" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              method === "card" ? "Approval code / last 6 digits"
              : method === "ewallet" ? "E-wallet transaction ID"
              : method === "transfer" ? "Bank reference number"
              : "QRIS ID / Merchant Ref"
            }
          />
        </div>
      )}

      {/* Note */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded-2xl px-4 py-2 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Transaction note…"
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-11 border border-gray-300 rounded-full text-sm hover:bg-gray-50" disabled={loading}>Cancel</button>
        <button type="button" onClick={submit} className="flex-1 h-11 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 disabled:opacity-60" disabled={!canSubmit}>
          {loading ? "Processing…" : "Pay"}
        </button>
      </div>
    </div>
  );
}
