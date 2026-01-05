import React from "react";

const OrderItem = ({
  item,
  itemDiscounts = [],     // ✅ DARI PARENT (BUKAN API)
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
}) => {
  const unitPrice = Number(item.price || 0);
  const qty = Number(item.quantity || 0);

  const formatCurrency = (amount) =>
    `Rp${Number(amount || 0).toLocaleString("id-ID")}`;

  /* ===== Product Thumbnail ===== */
  function ProductThumb({ src, alt }) {
    const [err, setErr] = React.useState(false);

    if (!src || err) {
      return (
        <div
          className="w-12 h-12 rounded bg-gray-200 text-gray-500 text-[10px] font-bold
                     flex items-center justify-center border border-gray-300"
        >
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
        className="w-12 h-12 rounded object-cover border border-gray-300 bg-white"
      />
    );
  }

  return (
    <div className="flex items-start justify-between py-3 border-b">
      {/* LEFT */}
      <div className="flex items-start space-x-3 flex-1">
        <div className="shrink-0">
          <ProductThumb
            src={item.image || item.thumbnail_url || item.photo_url}
            alt={item.name}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-gray-800 font-medium truncate">
            {item.name}
          </div>
          <div className="text-xs text-gray-500">
            Harga: {formatCurrency(unitPrice)}
          </div>

          {/* ITEM DISCOUNT (MASTER) */}
          <div className="mt-1 flex items-center gap-2">
            <select
              value={item.item_discount_id || ""}
              onChange={(e) => {
                const val = e.target.value;

                // NO DISCOUNT
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
              className="rounded border border-gray-300 text-sm px-2 py-1
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">No Discount</option>
              {itemDiscounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {item.item_discount_id && (
              <span className="text-[11px] text-blue-600 font-medium">
                Promo applied
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="ml-3 flex flex-col items-end gap-2 shrink-0">
        {/* Qty controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onUpdateQuantity(item.id, -1)}
            className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center
                       text-gray-600 hover:bg-gray-300"
          >
            –
          </button>
          <span className="text-sm font-medium w-6 text-center">
            {qty}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.id, 1)}
            className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center
                       text-white hover:bg-blue-600"
          >
            +
          </button>
        </div>

        {/* Price preview (belum diskon) */}
        <div className="text-right">
          <div className="text-sm font-medium text-gray-800">
            {formatCurrency(unitPrice * qty)}
          </div>
          <div className="text-[11px] text-gray-500">
            ({qty} × {formatCurrency(unitPrice)})
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderItem;
