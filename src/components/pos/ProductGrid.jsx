// components/pos/ProductGrid.jsx
import React from "react";
import ProductCard from "./ProductCard";

const ProductGrid = ({ products, onAddToCart }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((p) => {
        // fallback id & nama & lain-lain tetap seperti sebelumnya
        const id =
          p.id ?? p.product_id ?? p.sku;

        const image =
          p.image_url ||
          p.image ||
          p.thumbnail_url ||
          p.photo_url ||
          null;

        const name =
          p.name ||
          p.product_name ||
          p.title ||
          p.nama ||
          "Tanpa Nama";

        const price = Number(
          p.price ?? p.unit_price ?? p.sale_price ?? 0
        );

        const stock =
          p.stock ?? p.qty ?? p.quantity ?? 0;

        // ✅ flag stok / non-stock:
        // - utamakan is_stock_tracked dari backend
        // - bisa juga support nama lain kalau nanti berubah
        const isStockTracked =
          p.is_stock_tracked ??
          p.track_inventory ??
          p.isStockTracked ??
          true; // default: true supaya kompatibel

        return (
          <ProductCard
            key={id}
            id={id}
            image={image}
            name={name}
            price={price}
            stock={stock}
            isStockTracked={!!isStockTracked}  
            onAddToCart={onAddToCart}
          />
        );
      })}
    </div>
  );
};

export default ProductGrid;
