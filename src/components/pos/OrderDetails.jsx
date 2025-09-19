import React from 'react';
import OrderItem from './OrderItem';

const OrderDetails = ({ items, onUpdateQuantity, onUpdateDiscount, onRemoveItem }) => {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Order Details</h2>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No items in cart</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={item.id}>
              <OrderItem
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateDiscount={onUpdateDiscount}   
                onRemove={onRemoveItem}
              />
              {index < items.length - 1 && <hr className="border-gray-200" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;
