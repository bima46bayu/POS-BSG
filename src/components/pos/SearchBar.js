import React, { useState } from "react";

const SearchBar = ({ onSearch, onFilter, onScan }) => {
  const [q, setQ] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] sm:min-w-[240px]">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onSearch?.(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && onSearch?.(q)}
          placeholder="Search category or menu"
          className="h-10 w-full pl-10 pr-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search products"
        />
        {/* icon search */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
      </div>

      {/* Filter button */}
      <button
        type="button"
        onClick={onFilter}
        className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition whitespace-nowrap"
        aria-label="Open filter"
      >
        Filter
        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Scanner button */}
      <button
        type="button"
        onClick={onScan}
        className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition whitespace-nowrap"
        aria-label="Open scanner"
      >
        Scanner
        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2M7 12h10" />
        </svg>
      </button>
    </div>
  );
};

export default SearchBar;
