// components/pos/ProductGrid.jsx
import React from "react";
import ProductCard from "./ProductCard";

const ProductGrid = ({ products, onAddToCart }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((p) => {
        const id = p.id ?? p.product_id ?? p.sku;

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

        const price = Number(p.price ?? p.unit_price ?? p.sale_price ?? 0);

        const stock = p.stock ?? p.qty ?? p.quantity ?? 0;

        const isStockTracked =
          p.is_stock_tracked ??
          p.track_inventory ??
          p.isStockTracked ??
          true;

        const hasRecipe = !!(p.hasRecipe ?? p.has_recipe);
        const availableToMake =
          p.availableToMake ?? p.available_to_make ?? null;
        const recipeBottleneck =
          p.recipeBottleneck ?? p.recipe_bottleneck ?? null;

        const optionGroups = p.optionGroups ?? p.option_groups ?? [];

        return (
          <ProductCard
            key={id}
            id={id}
            image={image}
            name={name}
            price={price}
            stock={stock}
            isStockTracked={!!isStockTracked}
            hasRecipe={hasRecipe}
            availableToMake={availableToMake}
            recipeBottleneck={recipeBottleneck}
            optionGroups={optionGroups}
            onAddToCart={onAddToCart}
          />
        );
      })}
    </div>
  );
};

export default ProductGrid;
