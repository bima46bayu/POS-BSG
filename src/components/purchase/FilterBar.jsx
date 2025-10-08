// src/components/purchase/FilterBar.jsx
import React, { useMemo, useRef, useState } from "react";
import { Download, Filter, Plus, X, Search } from "lucide-react";

export default function FilterBar({ value, onChange, onAdd, onExport, filters = {}, setFilters }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const activeCount = useMemo(() => {
    const keys = ["supplier_id", "status", "from", "to"];
    return keys.reduce((n, k) => (filters?.[k] ? n + 1 : n), 0);
  }, [filters]);

  const toggle = () => {
    if (!open) {
      const el = btnRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const width = 360;
        const gap = 8;
        const left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
        const top = Math.min(r.bottom + gap, window.innerHeight - 8);
        setPos({ top, left });
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div className="w-full">
      {/* Card full width */}
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
        {/* Bar full width: search grow, buttons shrink */}
        <div className="flex items-center gap-2 w-full">
          {/* SEARCH (grow full) */}
          <div className="relative flex-1 min-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="Search PO number / product / supplier"
              className="w-full h-10 pl-10 pr-9 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {value ? (
              <button
                onClick={() => onChange?.("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100 text-gray-500"
                aria-label="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* FILTER */}
          <button
            ref={btnRef}
            onClick={toggle}
            className="relative inline-flex items-center gap-2 h-10 px-3 shrink-0 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                {activeCount}
              </span>
            )}
          </button>

          {/* EXPORT */}
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 h-10 px-3 shrink-0 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {/* ADD (kanan) */}
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 h-10 px-4 shrink-0 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            <span>Add Purchase</span>
          </button>
        </div>
      </div>

      {/* Overlay popover */}
      {open && <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />}

      {/* Panel popover nempel tombol */}
      {open && (
        <div
          className="fixed z-50 w-[22rem] bg-white rounded-xl shadow-lg border border-gray-200"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* <div>
                <label className="block text-xs text-gray-600 mb-1">Supplier ID</label>
                <input
                  value={filters?.supplier_id || ""}
                  onChange={(e) => setFilters?.((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 1"
                />
              </div> */}

              <div>
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select
                  value={filters?.status || ""}
                  onChange={(e) => setFilters?.((f) => ({ ...f, status: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="partially_received">Partially Received</option>
                  <option value="closed">Closed</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters?.from || ""}
                    onChange={(e) => setFilters?.((f) => ({ ...f, from: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={filters?.to || ""}
                    onChange={(e) => setFilters?.((f) => ({ ...f, to: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <button onClick={() => setFilters?.({})} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">
                Clear All
              </button>
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
