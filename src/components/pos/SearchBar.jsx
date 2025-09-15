import React, { useEffect, useRef, useState } from "react";

const SearchBar = ({ onSearch, onFilter, onScan }) => {
  const [q, setQ] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [scanBuffer, setScanBuffer] = useState("");
  const hiddenInputRef = useRef(null);
  const timerRef = useRef(null);

  // Fokuskan hidden input saat scan aktif
  useEffect(() => {
    if (scanActive) {
      setScanBuffer("");
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      setScanBuffer("");
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [scanActive]);

  const commitScan = () => {
    const code = scanBuffer.trim();
    if (code) onScan?.(code);
    setScanActive(false);   // matikan mode scan setelah dapat kode
    setScanBuffer("");
  };

  const handleHiddenKeyDown = (e) => {
    // Enter/Tab biasanya dikirim di akhir oleh scanner
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commitScan();
      return;
    }
    // Ambil hanya karakter printable
    if (e.key.length === 1) {
      setScanBuffer((prev) => prev + e.key);
    }
    // Fallback: kalau scanner tidak kirim Enter, commit setelah jeda
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (scanBuffer) commitScan();
    }, 120);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        {/* Search manual (tetap jalan sendiri) */}
        <div className="relative flex-1 min-w-[180px] sm:min-w-[240px]">
          <input
            type="text"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              onSearch?.(v);
            }}
            onKeyDown={(e) => e.key === "Enter" && onSearch?.(q)}
            placeholder="Search category or product"
            className="h-10 w-full pl-10 pr-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search products"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
        </div>

        {/* Filter */}
        <button
          type="button"
          onClick={onFilter}
          className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition whitespace-nowrap"
        >
          Filter
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Toggle Scanner (gun) */}
        <button
          type="button"
          onClick={() => setScanActive((v) => !v)}
          className={`inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-semibold transition whitespace-nowrap focus:outline-none
            ${scanActive
              ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] border border-blue-600"
              : "border border-gray-300 text-gray-500 bg-white hover:bg-gray-50"}`}
          aria-pressed={scanActive}
        >
          {scanActive ? "Scanning…" : "Scanner"}
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2M7 12h10" />
          </svg>
        </button>
      </div>

      {/* Hidden input khusus gun scanner */}
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
};

export default SearchBar;
