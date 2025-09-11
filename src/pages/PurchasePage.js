import React from 'react';

const PurchasePage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-4 text-blue-700">PurchasePage</h1>
      <p className="text-lg text-gray-700 mb-8">Welcome to the POS system!</p>
      {/* Tambahkan fitur POS di sini */}
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        onClick={() => alert('Transaksi dimulai!')}
      >
        Mulai Transaksi
      </button>
    </div>
  );
};

export default PurchasePage;