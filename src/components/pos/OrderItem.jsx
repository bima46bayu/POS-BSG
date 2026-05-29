import React from "react";

const OrderItem = ({
  item,
  itemDiscounts = [],
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
}) => {
  const unitPrice = Number(item.price || 0);
  const qty = Number(item.quantity || 0);

  const formatCurrency = (amount) =>
    `Rp${Number(amount || 0).toLocaleString("id-ID")}`;

  function ProductThumb({ src, alt }) {
    const [err, setErr] = React.useState(false);

    if (!src || err) {
      return (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center border border-gray-300 shrink-0">
          N/A
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={alt || "product"}
        loading="lazy"
        onError={() => setErr(true)}
        className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover border border-gray-300 bg-white shrink-0"
      />
    );
  }

  return (
    <div className="py-3 border-b border-gray-200 min-w-0 max-w-full">
      <div className="flex gap-2 sm:gap-3 min-w-0">
        <ProductThumb
          src={item.image || item.thumbnail_url || item.photo_url}
          alt={item.name}
        />

        <div className="min-w-0 flex-1">
          {/* Name + qty */}
          <div className="flex items-start gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-medium text-gray-800 truncate"
                title={item.name}
              >
                {item.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {formatCurrency(unitPrice)} / item
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, -1)}
                className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                aria-label="Decrease quantity"
              >
                –
              </button>
              <span className="text-sm font-medium w-5 text-center tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, 1)}
                className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white hover:bg-blue-600"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Discount — full width of content column */}
          <div className="mt-2 min-w-0">
            <select
              value={item.item_discount_id || ""}
              onChange={(e) => {
                const val = e.target.value;

                if (!val) {
                  onUpdateDiscount?.(item.id, {
                    item_discount_id: null,
                    discount_type: "%",
                    discount_value: 0,
                  });
                  return;
                }

                const d = itemDiscounts.find(
                  (x) => String(x.id) === String(val)
                );
                if (!d) return;

                onUpdateDiscount?.(item.id, {
                  item_discount_id: d.id,
                  discount_type: d.kind === "PERCENT" ? "%" : "rp",
                  discount_value: Number(d.value),
                });
              }}
              className="w-full max-w-full min-w-0 box-border rounded border border-gray-300 text-xs sm:text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">No Discount</option>
              {itemDiscounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {item.item_discount_id && (
              <p className="mt-1 text-[11px] text-blue-600 font-medium">
                Promo applied
              </p>
            )}
          </div>

          {/* Line total */}
          <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
            <span className="text-[11px] text-gray-500 truncate">
              {qty} × {formatCurrency(unitPrice)}
            </span>
            <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
              {formatCurrency(unitPrice * qty)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderItem;
