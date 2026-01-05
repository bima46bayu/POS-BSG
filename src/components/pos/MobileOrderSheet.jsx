// src/components/pos/MobileOrderSheet.jsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ShoppingCart } from "lucide-react";
import OrderDetails from "./OrderDetails";
import SaleSubmitter from "./SaleSubmitter";
import toast from "react-hot-toast";

/**
 * Props:
 *  - open, onClose
 *  - items
 *  - itemDiscounts        // NEW
 *  - globalDiscounts      // NEW
 *  - onUpdateQuantity, onUpdateDiscount, onRemoveItem
 *  - subtotal, tax, total
 *  - onClearCart
 */
export default function MobileOrderSheet({
  open,
  onClose,
  items = [],
  itemDiscounts,        // ✅ TAMBAH
  globalDiscounts,      // ✅ TAMBAH
  onUpdateQuantity,
  onUpdateDiscount = () => {},
  onRemoveItem,
  subtotal,
  tax,
  total,
  onClearCart,
}) {
  // Lock body scroll saat sheet terbuka saja
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Tetap mounted demi animasi close; pakai pointer-events untuk blok/izinkan klik
  return createPortal(
    <div
      className={`fixed inset-0 z-[100] md:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* BACKDROP */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* SHEET */}
      <div
        className={`absolute inset-x-0 bottom-0
                    max-h-[88vh] rounded-t-2xl bg-white shadow-2xl border-t border-gray-200
                    transition-transform duration-300 ease-out
                    ${open ? "translate-y-0" : "translate-y-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" />
            Cart{" "}
            <span className="text-gray-500 font-normal">
              ({items?.length || 0})
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
            aria-label="Close cart"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          <OrderDetails
            items={items}
            itemDiscounts={itemDiscounts}   // ✅ TERUSKAN
            onUpdateQuantity={onUpdateQuantity}
            onUpdateDiscount={onUpdateDiscount}
            onRemoveItem={onRemoveItem}
          />

          <SaleSubmitter
            items={items}
            subtotal={subtotal}
            tax={tax}
            total={total}
            globalDiscounts={globalDiscounts} // ✅ TERUSKAN
            onSuccess={(res) => {
              onClearCart?.();
              onClose?.();
              toast.success(
                `Transaction success! Code: ${res?.code || res?.id || "-"}`
              );
            }}
            onCancel={onClearCart}
            showSummary={true}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
