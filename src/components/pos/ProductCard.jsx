import React, { memo, useMemo } from "react";

const ProductCard = memo(function ProductCard({
  id,
  image,
  name,
  price,
  stock = 0,
  isStockTracked = true, // ✅ baru: true = produk stok, false = non-stock / jasa
  onAddToCart,
  className = "",
}) {
  const priceText = useMemo(
    () => Number(price || 0).toLocaleString("id-ID"),
    [price]
  );

  // ✅ Non-stock = tidak pernah out of stock
  const outOfStock = isStockTracked && Number(stock) <= 0;

  // ✅ Teks stok: unlimited kalau non-stock
  const stockLabel = !isStockTracked
    ? "Unlimited stock"
    : outOfStock
    ? "Out of stock"
    : `${stock} in stock`;

  return (
    <div
      className={`flex flex-col bg-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-shadow duration-150 ${className}`}
    >
      {/* Image area */}
      <div className="relative w-full h-28 bg-gray-100 rounded-xl mb-2 overflow-hidden">
      {image ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          className="
            absolute inset-0
            w-full h-full
            object-contain
            transition-opacity duration-300
            opacity-0
          "
          onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-400 text-xs">
          No Image
        </div>
      )}
    </div>

      {/* Info */}
      <div className="text-center mb-2">
        <h3 className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 break-words">
          {name}
        </h3>
        <p className="text-base font-bold text-orange-500 mt-1">
          Rp{priceText}
        </p>
        <p
          className={`text-[10px] mt-0.5 ${
            outOfStock && isStockTracked ? "text-red-500" : "text-gray-500"
          }`}
        >
          {stockLabel}
        </p>
      </div>

      {/* Button */}
      <button
        onClick={() =>
          onAddToCart?.({
            id,
            name,
            price,
            image,
            stock,
            isStockTracked,
          })
        }
        disabled={outOfStock} // ✅ non-stock tidak pernah disabled karena out-of-stock
        className={`mt-auto h-8 w-full rounded-full font-semibold text-white text-xs
          ${
            outOfStock
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
          }
          transition-all duration-150
        `}
      >
        {outOfStock ? "Out of Stock" : "Add to Cart"}
      </button>
    </div>
  );
});

export default ProductCard;
