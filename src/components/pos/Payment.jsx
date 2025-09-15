import React, { useState } from 'react';
import { ChevronDown } from "lucide-react";

const Payment = ({ total, onPayment, onCancel }) => {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  const calculateChange = () => {
    const amount = parseInt(paymentAmount.replace(/\D/g, '')) || 0;
    return Math.max(0, amount - total);
  };

  const formatCurrency = (amount) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
  };

  const handleComplete = () => {
    const amount = parseInt(paymentAmount.replace(/\D/g, '')) || 0;
    if (amount >= total) {
      onPayment({
        method: paymentMethod,
        amount: amount,
        change: calculateChange()
      });
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Payment</h3>
      
      <div className="flex space-x-3 mb-4">
        <div className="relative">
        <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-10 w-full px-4 pr-6 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
        >
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Transfer">Transfer</option>
            <option value="E-Wallet">E-Wallet</option>
            <option value="QRIS">QRIS</option>
        </select>

        {/* Custom icon dari lucide-react */}
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        
        <div className="relative flex-1">
        {/* Prefix Rp di dalam input */}
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 text-sm">
                Rp
            </span>
            <input
                type="number"
                placeholder="Payment Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-10 w-full pl-10 pr-4 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            </div>
        </div>
      
      <div className="flex space-x-3 mb-4">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 border border-red-300 text-red-600 rounded-full font-medium hover:bg-red-50"
        >
          Cancel
        </button>
        <button 
          onClick={handleComplete}
          disabled={parseInt(paymentAmount.replace(/\D/g, '')) < total}
          className="flex-1 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Complete
        </button>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Change</span>
        <span className="font-medium text-blue-600">
          {formatCurrency(calculateChange())}
        </span>
      </div>
    </div>
  );
};

export default Payment;