// src/components/common/ExportPdfModal.jsx
import React, { useEffect, useState } from "react";

export default function ExportPdfModal({ open, onClose, onConfirm, defaultFrom, defaultTo, loading }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (open) {
      setFrom(defaultFrom ?? "");
      setTo(defaultTo ?? "");
    }
  }, [open, defaultFrom, defaultTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      {/* content */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-base font-semibold text-slate-900">Export Stock Card (PDF)</div>
          <div className="mt-1 text-xs text-slate-500">
            Pilih rentang tanggal yang akan diexport.
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-xs text-slate-600 mb-1">Dari Tanggal</span>
              <input
                type="date"
                value={from || ""}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-slate-200"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-600 mb-1">Sampai Tanggal</span>
              <input
                type="date"
                value={to || ""}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-slate-200"
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Kosongkan salah satu jika ingin pakai batas default sistem.
          </p>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={() => onConfirm?.({ from, to })}
            className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Mengekspor..." : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
