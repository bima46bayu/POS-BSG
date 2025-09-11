import React from 'react';

const OrderItem = ({ item, onUpdateQuantity, onRemove }) => {
  const formatCurrency = (amount) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center">
          <div className="text-white text-xs font-bold">LOGO</div>
        </div>
        <span className="text-gray-700 font-medium">{item.name}</span>
      </div>
      
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => onUpdateQuantity(item.id, -1)}
            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
          >
            -
          </button>
          <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
          <button 
            onClick={() => onUpdateQuantity(item.id, 1)}
            className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white hover:bg-blue-600"
          >
            +
          </button>
        </div>
        <span className="text-sm font-medium text-gray-700">
          {formatCurrency(item.price)}
        </span>
      </div>
    </div>
  );
};

export default OrderItem;