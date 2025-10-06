import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TablePagination = ({
  current = 1,
  total = 1,
  perPage = 10,
  totalItems = 0,
  onChange
}) => {
  if (total <= 1) return null;

  const startIndex = (current - 1) * perPage + 1;
  const endIndex = Math.min(current * perPage, totalItems);

  return (
    <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Info */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startIndex}</span> to{' '}
        <span className="font-medium">{endIndex}</span> of{' '}
        <span className="font-medium">{totalItems}</span> results
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange && onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          className="p-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <span className="px-3 py-1.5 text-sm text-gray-700">
          Page {current} of {total}
        </span>
        
        <button
          onClick={() => onChange && onChange(Math.min(total, current + 1))}
          disabled={current === total}
          className="p-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;