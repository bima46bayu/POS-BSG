// src/pages/UnauthorizedPage.jsx
import React from "react";
import { ShieldAlert, LogIn } from "lucide-react";
import { STORAGE_KEY } from "../api/client";
import { useNavigate } from "react-router-dom";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const handleLogin = () => {
    // pastikan storage bersih lalu ke login
    localStorage.removeItem(STORAGE_KEY);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-rose-500" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Sesi Berakhir</h1>
        <p className="mt-2 text-slate-600 text-sm">
          Token Anda tidak valid atau akun dipakai di perangkat lain. Silakan login ulang untuk melanjutkan.
        </p>
        <button
          onClick={handleLogin}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
        >
          <LogIn className="w-4 h-4" />
          Kembali ke Login
        </button>
      </div>
    </div>
  );
}
