import React from 'react';
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";


const InventoryPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-4 text-blue-700">InventoryPage</h1>
      <p className="text-lg text-gray-700 mb-8">Comming Soon!</p>
      {/* Tambahkan fitur POS di sini */}
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        onClick={() => toast.success('Transaksi dimulai!')}
      >
        Mulai Transaksi
      </button>
    </div>
  );
};

export default InventoryPage;