import React, { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  ChevronDown,
  ChevronUp,
  ScanLine,
  Store as StoreIcon,
} from "lucide-react";

export default function SearchBar({
  onSearch,
  onScan,
  onFilterChange,
  categories = [],
  subCategories = [],
  onPickCategory,

  // ===== props selector cabang (admin) =====
  showStoreSelector = false,                 // true => tampilkan selector
  storeOptions = [],                         // [{value:'ALL', label:'Semua'}, {value:'1', label:'Instafactory'}, ...]
  selectedStoreId,                           // string
  onChangeStore,                             // (val:string)=>void
  storeDisabled = false,                     // loading dsb.
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // filter local state
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("any");

  // scanner
  const [scanActive, setScanActive] = useState(false);
  const [scanBuffer, setScanBuffer] = useState("");
  const hiddenInputRef = useRef(null);
  const timerRef = useRef(null);
  const focusCheckIntervalRef = useRef(null);

  // store dropdown
  const [storeOpen, setStoreOpen] = useState(false);
  const storeRef = useRef(null);

  useEffect(() => { setSubCategoryId(""); }, [categoryId]);

  // close store popover saat klik di luar
  useEffect(() => {
    function onDocClick(e) {
      if (!storeRef.current) return;
      if (!storeRef.current.contains(e.target)) setStoreOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Auto-pause scanner saat filter dropdown dibuka
  useEffect(() => {
    if (open && scanActive) {
      if (focusCheckIntervalRef.current) clearInterval(focusCheckIntervalRef.current);
    }
  }, [open, scanActive]);

  // Focus management & auto re-focus untuk scanner
  useEffect(() => {
    if (scanActive && !open) {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 0);
      focusCheckIntervalRef.current = setInterval(() => {
        const el = hiddenInputRef.current;
        if (!el) return;
        const act = document.activeElement;
        const typing =
          act?.tagName === "INPUT" || act?.tagName === "TEXTAREA" || act?.tagName === "SELECT";
        if (!typing && act !== el) el.focus();
      }, 300);
      return () => {
        clearTimeout(t);
        if (focusCheckIntervalRef.current) clearInterval(focusCheckIntervalRef.current);
      };
    } else {
      setScanBuffer("");
      if (timerRef.current) clearTimeout(timerRef.current);
      if (focusCheckIntervalRef.current) clearInterval(focusCheckIntervalRef.current);
    }
  }, [scanActive, open]);

  const commitScan = () => {
    const code = scanBuffer.trim();
    if (code) onScan?.(code);
    setScanBuffer("");
    if (scanActive) setTimeout(() => hiddenInputRef.current?.focus(), 50);
  };

  const handleHiddenKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (timerRef.current) clearTimeout(timerRef.current);
      commitScan();
      return;
    }
    if (e.key.length === 1) setScanBuffer((prev) => prev + e.key);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commitScan, 100);
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

  const currentStoreLabel =
    storeOptions.find((o) => String(o.value) === String(selectedStoreId))?.label ||
    "Pilih Cabang";

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2 mb-4">
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

        {/* Store selector pill (admin only, custom dropdown) */}
        {showStoreSelector && (
          <div className="relative" ref={storeRef}>
            <button
              type="button"
              onClick={() => !storeDisabled && setStoreOpen((v) => !v)}
              onKeyDown={(e) => {
                if (storeDisabled) return;
                if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                  e.preventDefault();
                  setStoreOpen((v) => !v);
                }
              }}
              className={[
                "h-11 inline-flex items-center gap-2 rounded-full px-4",
                "border text-sm font-medium",
                storeDisabled
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
              aria-haspopup="listbox"
              aria-expanded={storeOpen}
            >
              <StoreIcon className="w-4 h-4 text-gray-500" />
              <span className="truncate max-w-[140px]">{currentStoreLabel}</span>
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${storeOpen ? "rotate-180" : ""}`} />
            </button>

            {storeOpen && (
              <div
                role="listbox"
                tabIndex={-1}
                className="absolute right-0 mt-2 w-56 z-30 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden"
              >
                <div className="max-h-64 overflow-auto py-1">
                  {storeOptions.map((opt) => {
                    const active = String(opt.value) === String(selectedStoreId);
                    return (
                      <button
                        key={String(opt.value)}
                        role="option"
                        aria-selected={active}
                        onClick={() => { onChangeStore?.(String(opt.value)); setStoreOpen(false); }}
                        className={[
                          "w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                          active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: active ? "#2563eb" : "transparent" }}
                        />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden input untuk scanner */}
      {scanActive && !open && (
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
