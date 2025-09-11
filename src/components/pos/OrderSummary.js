import React from 'react';

const OrderSummary = ({ items }) => {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Math.round(total * 0.11); // 11% tax
  const subtotal = total + tax;

  const formatCurrency = (amount) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Order Summary</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total</span>
          <span className="font-medium">{formatCurrency(total)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (11%)</span>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>
        
        <hr className="border-gray-200 my-2" />
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium text-blue-600">{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;