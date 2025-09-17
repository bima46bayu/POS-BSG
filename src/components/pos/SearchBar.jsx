import React, { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  ChevronDown,
  ChevronUp,
  ScanLine
} from "lucide-react";

export default function SearchBar({
  onSearch,
  onScan,
  onFilterChange,
  categories = [],
  subCategories = [],
  onPickCategory,
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // filter local state
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("any"); // any|available|out

  // scanner
  const [scanActive, setScanActive] = useState(false);
  const [scanBuffer, setScanBuffer] = useState("");
  const hiddenInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { setSubCategoryId(""); }, [categoryId]);

  // scanner focus
  useEffect(() => {
    if (scanActive) {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setScanBuffer("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [scanActive]);

  const commitScan = () => {
    const code = scanBuffer.trim();
    if (code) onScan?.(code);
    setScanActive(false);
    setScanBuffer("");
  };
  const handleHiddenKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault(); commitScan(); return;
    }
    if (e.key.length === 1) setScanBuffer((prev) => prev + e.key);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { if (scanBuffer) commitScan(); }, 120);
  };

  const filteredSubcats = subCategories.filter(
    (s) => !categoryId || String(s.category_id) === String(categoryId)
  );

  const applyFilter = () => {
    onFilterChange?.({
      category_id: categoryId || undefined,
      sub_category_id: subCategoryId || undefined,
      stock_status: stockStatus,
    });
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {/* Search pill */}
        <div className="relative flex-1">
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); onSearch?.(e.target.value); }}
            onKeyDown={(e) => e.key === "Enter" && onSearch?.(q)}
            placeholder="Search product / SKU"
            className="h-11 w-full pl-10 pr-4 rounded-full border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        {/* Filter pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="h-11 inline-flex items-center gap-1 rounded-full px-4 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          >
            Filter {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 z-20 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 space-y-3">
              {/* Category */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Category</label>
                <select
                  className="w-full h-10 px-3 rounded-full border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    onPickCategory?.(e.target.value || undefined);
                  }}
                >
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Sub Category */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sub Category</label>
                <select
                  className="w-full h-10 px-3 rounded-full border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={subCategoryId}
                  onChange={(e) => setSubCategoryId(e.target.value)}
                  disabled={!categoryId && filteredSubcats.length === 0}
                >
                  <option value="">All</option>
                  {filteredSubcats.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Stock</label>
                <div className="flex gap-2">
                  {[
                    { v: "any", t: "All" },
                    { v: "available", t: "Available" },
                    { v: "out", t: "Out of stock" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setStockStatus(o.v)}
                      className={`h-9 px-3 rounded-full text-sm border ${
                        stockStatus === o.v
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={applyFilter}
                className="w-full h-10 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Scanner pill */}
        <button
          type="button"
          onClick={() => setScanActive((v) => !v)}
          className={`h-11 inline-flex items-center gap-2 rounded-full px-4 border text-sm font-medium transition
            ${scanActive
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
        >
          <ScanLine className="h-4 w-4" />
          {scanActive ? "Scanning…" : "Scanner"}
        </button>
      </div>

      {/* Hidden input untuk scanner */}
      {scanActive && (
        <input
          ref={hiddenInputRef}
          type="text"
          value={scanBuffer}
          onChange={() => {}}
          onKeyDown={handleHiddenKeyDown}
          className="absolute opacity-0 pointer-events-none -z-10"
          aria-hidden="true"
        />
      )}
    </>
  );
}
