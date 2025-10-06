import React from 'react';

const Paginator = ({ 
  page = 1, 
  totalPages = 1, 
  totalItems = 0,
  pageSize = 10,
  onPageChange 
}) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Showing {start} - {end} of {totalItems}
      </p>
      
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span className="px-4 py-2 text-sm">
          {page} / {totalPages}
        </span>
        
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Paginator;