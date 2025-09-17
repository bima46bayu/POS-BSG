import React, { useEffect, useMemo, useState } from "react";
import { CreditCard, Wallet, Banknote, QrCode, ChevronDown, Landmark } from "lucide-react";

const METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "ewallet", label: "E-Wallet", icon: Wallet },
  { value: "transfer", label: "Bank Transfer", icon: Landmark },
  { value: "qris", label: "QRIS", icon: QrCode },
];

export default function Payment({ total, subtotal, tax, onPayment, onCancel, loading }) {
  const [method, setMethod] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [paid, setPaid] = useState("");           // amount received
  const [reference, setReference] = useState(""); // optional non-cash
  const [note, setNote] = useState("");

  // auto-fill for non-cash
  useEffect(() => {
    if (method !== "cash") setPaid(String(total || 0));
  }, [method, total]);

  const change = useMemo(() => {
    if (method !== "cash") return 0;
    const p = Number(paid || 0);
    return Math.max(0, p - Number(total || 0));
  }, [paid, total, method]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (Number(total) <= 0) return false;
    if (method === "cash") return Number(paid) >= Number(total);
    return true;
  }, [loading, method, paid, total]);

  const submit = () => {
    onPayment?.({
      payment_method: method,
      paid_amount: Number(paid || 0),
      reference: reference?.trim() || null,
      customer_name: customer || null,
      note,
    });
  };

  const CurrentIcon = METHODS.find((m) => m.value === method)?.icon || Banknote;
  const showBreakdown = typeof subtotal === "number" && typeof tax === "number";

  return (
    <div className="mt-4 border-t pt-4">
      {/* Breakdown (optional) */}
      {/* <div className="mb-3">
        {showBreakdown && (
          <>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Items Subtotal</span>
              <span>Rp{Number(subtotal).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>Rp{Number(tax).toLocaleString("id-ID")}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-lg font-semibold">
            Rp{Number(total).toLocaleString("id-ID")}
          </span>
        </div>
      </div> */}

      {/* Customer */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Name (optional)
        </label>
        <input
          type="text"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. John Doe"
        />
      </div>

      {/* Payment Method */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Method
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-11 appearance-none border rounded-full px-4 pr-9 text-sm bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Received */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Received (IDR)
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter amount"
        />
        {/* Change only for cash */}
        {method === "cash" && (
          <div className="flex items-center justify-between mt-1 text-sm">
            <span className="text-gray-500">Change</span>
            <span className="font-semibold">
              Rp{change.toLocaleString("id-ID")}
            </span>
          </div>
        )}
        {method === "cash" && paid && Number(paid) < Number(total) && (
          <div className="text-red-600 text-xs mt-1">
            Cash received is less than total.
          </div>
        )}
      </div>

      {/* Reference (non-cash) */}
      {method !== "cash" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference (optional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full h-11 border rounded-full px-4 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              method === "card"
                ? "Approval code / last 6 digits"
                : method === "ewallet"
                ? "E-wallet transaction ID"
                : method === "transfer"
                ? "Bank reference number"
                : "QRIS ID / Merchant Ref"
            }
          />
        </div>
      )}

      {/* Note */}
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
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
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 border border-gray-300 rounded-full text-sm hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 h-11 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          disabled={!canSubmit}
        >
          {loading ? "Processing…" : "Pay"}
        </button>
      </div>
    </div>
  );
}
