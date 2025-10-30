// src/pages/NotFoundPage.jsx
import React from "react";
import { Compass, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
          <Compass className="w-7 h-7 text-indigo-600" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Halaman Tidak Ditemukan</h1>
        <p className="mt-2 text-slate-600 text-sm">
          URL yang kamu akses tidak tersedia atau sudah dipindahkan.
        </p>
        <button
          onClick={() => navigate("/home", { replace: true })}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Home className="w-4 h-4" />
          Kembali ke Home
        </button>
      </div>
    </div>
  );
}
