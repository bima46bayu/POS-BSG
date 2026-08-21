// src/pages/UnauthorizedPage.jsx
import React from "react";
import { ShieldAlert, LogIn } from "lucide-react";
import { STORAGE_KEY } from "../api/client";

export default function UnauthorizedPage() {
  const handleLogin = () => {
    // Pakai reload penuh, bukan navigate(). Saat halaman ini tampil, state
    // `loggedIn` di AppShell masih true, jadi navigate("/") hanya akan
    // di-redirect balik ke /home dan memicu 401 lagi. Reload me-reset state
    // React sepenuhnya, dan karena storage sudah bersih, app kembali ke login.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.location.replace("/");
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
