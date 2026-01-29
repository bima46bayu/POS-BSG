// src/components/dashboard/FilterBar.jsx
import React, { useRef, useState, useEffect } from "react";
import { Search, Calendar, Store, Tag, Download, ChevronDown } from "lucide-react";
import DateRangePicker from "../DateRangePicker";
import useAnchoredPopover from "../../lib/useAnchoredPopover";

export default function FilterBar({
  filters,
  setFilters,
  stores = [],
  onExport,
  isLoading,
  locked = false,
}) {
  const dateRangeBtnRef = useRef(null);
  const dateRangePopover = useAnchoredPopover();
  useEffect(() => { dateRangePopover.setAnchor(dateRangeBtnRef.current); }, [dateRangePopover]);

  const onChange = (patch) => {
    if (locked) return; // cegah perubahan di mode terkunci, kecuali yang kita izinkan di bawah
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  // ===== MODE TERKUNCI (kasir) =====
  if (locked) {
    const storeName = (() => {
      const id = String(filters.storeId || "");
      const f = stores.find((s) => String(s.id) === id);
      return f?.name || "Terkunci";
    })();

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        {/* gunakan lebar kolom yang sama seperti mode normal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Pencarian (tidak aktif) */}
          <div className="lg:col-span-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Pencarian</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <div className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400">
                Tidak tersedia untuk Kasir
              </div>
            </div>
          </div>

          {/* Periode (read-only) */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-2">Periode</label>
            <div className="relative">
              <div className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700">
                {filters.from === filters.to ? filters.from : `${filters.from} - ${filters.to}`}
              </div>
            </div>
          </div>

          {/* Cabang (read-only) */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-2">Cabang</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <div className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700">
                {storeName}
              </div>
            </div>
          </div>
        </div>

        {/* Diskon & Export: tetap AKTIF */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.onlyDiscount}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, onlyDiscount: e.target.checked }))
              }
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <Tag className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Hanya Transaksi Diskon</span>
          </label>

          <button
            onClick={onExport}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>
    );
  }

  // ===== MODE NORMAL =====
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <label className="block text-sm font-medium text-slate-700 mb-2">Pencarian</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Cari invoice, produk, kasir..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-2">Periode</label>
          <div className="relative">
            <button
              ref={dateRangeBtnRef}
              onClick={() => dateRangePopover.setOpen(!dateRangePopover.open)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-left flex items-center gap-2 bg-white hover:bg-slate-50"
            >
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{filters.from === filters.to ? filters.from : `${filters.from} - ${filters.to}`}</span>
            </button>
            {dateRangePopover.open && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => dateRangePopover.setOpen(false)} />
                <div
                  className="fixed z-50"
                  style={{ top: dateRangePopover.pos.top, left: dateRangePopover.pos.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <DateRangePicker
                    startDate={filters.from}
                    endDate={filters.to}
                    onStartChange={(d) => onChange({ from: d })}
                    onEndChange={(d) => onChange({ to: d })}
                    onClose={() => dateRangePopover.setOpen(false)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Cabang</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
            <select
              value={filters.storeId}
              onChange={(e) => onChange({ storeId: e.target.value })}
              className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">Semua</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onlyDiscount}
            onChange={(e) => onChange({ onlyDiscount: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
        <Tag className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Hanya Transaksi Diskon</span>
        </label>

        <button
          onClick={onExport}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>
    </div>
  );
}
