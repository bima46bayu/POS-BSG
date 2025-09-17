import React, { useEffect } from "react";
import { X, ShoppingCart } from "lucide-react";
import OrderDetails from "./OrderDetails";
import SaleSubmitter from "./SaleSubmitter";

export default function MobileOrderSheet({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  subtotal,
  tax,
  total,
  onClearCart,
}) {
  // lock body scroll saat sheet terbuka
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed left-0 right-0 bottom-0 z-50 md:hidden transform transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4" />
              Cart <span className="text-gray-500 font-normal">({items?.length || 0})</span>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Close cart"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[75vh] overflow-y-auto px-4 py-4 space-y-4">
            <OrderDetails
              items={items}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
            />

            <SaleSubmitter
              items={items}
              subtotal={subtotal}
              tax={tax}
              total={total}
              onSuccess={(res) => {
                onClose?.();
                onClearCart?.();
                alert(`Transaction success! Code: ${res?.code || res?.id || "-"}`);
              }}
              onCancel={onClearCart}
              showSummary={true}
            />
          </div>
        </div>
      </div>
    </>
  );
}
