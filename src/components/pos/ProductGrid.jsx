// components/pos/ProductGrid.jsx
import React from "react";
import ProductCard from "./ProductCard";

const ProductGrid = ({ products, onAddToCart }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((p) => (
        <ProductCard
          key={p.id ?? p.product_id ?? p.sku}
          id={p.id ?? p.product_id ?? p.sku}
          image={p.image_url || p.image || p.thumbnail_url || p.photo_url || p.image || null}
          name={p.name || p.product_name || p.title || p.nama || "Tanpa Nama"}
          price={Number(p.price ?? p.unit_price ?? p.sale_price ?? 0)}
          stock={p.stock ?? p.qty ?? p.quantity ?? 0}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
};

export default ProductGrid;
