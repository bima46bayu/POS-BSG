import React from "react";
import ProductCard from "./ProductCard";

const ProductGrid = ({ products, onAddToCart }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          id={p.id}
          image={p.image}
          name={p.name}
          price={p.price}
          stock={p.stock ?? 10}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
};

export default ProductGrid;
