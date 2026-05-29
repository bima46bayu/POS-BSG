import React from "react";
import OrderItem from "./OrderItem";

const OrderDetails = ({
  items,
  itemDiscounts,          // ✅ TERIMA DARI POSPage
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
}) => {
  return (
    <div className="mb-6 min-w-0 max-w-full overflow-x-hidden">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        Order Details
      </h2>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No items in cart</p>
        </div>
      ) : (
        <div className="space-y-0 min-w-0 max-w-full">
          {items.map((item) => (
            <OrderItem
              key={item.id}
              item={item}
              itemDiscounts={itemDiscounts}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateDiscount={onUpdateDiscount}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;
