import React, { useState } from "react";
import { Download, Filter, Plus, X } from "lucide-react";

export default function FilterBar({ value, onChange, onAdd, onExport, filters, setFilters }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 w-full md:w-auto">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full md:w-72 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search PO number / product / supplier"
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      {open && (
        <div className="relative">
          <div className="absolute right-0 md:left-0 z-20 mt-2 w-[22rem] bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Supplier ID</label>
                  <input
                    value={filters.supplier_id || ""}
                    onChange={(e) => setFilters((f) => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Status</label>
                  <select
                    value={filters.status || ""}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="partially_received">Partially Received</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={filters.from || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="date"
                      value={filters.to || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                <button onClick={() => setFilters({})} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">Clear All</button>
                <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}