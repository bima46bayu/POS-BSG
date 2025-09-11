// src/components/ui/Table/TableHeader.js
import React from 'react';

const TableHeader = ({ 
  columns = [], 
  onSort,
  sortConfig = null,
  className = "" 
}) => {
  const handleSort = (key) => {
    if (!onSort) return;
    
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    onSort({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortConfig.direction === 'asc') {
      return (
        <svg className="w-4 h-4 ml-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 ml-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <thead className={`bg-gray-50 ${className}`}>
      <tr>
        {columns.map((column, index) => (
          <th
            key={column.key || index}
            className={`
              px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
              ${column.sortable && onSort ? 'cursor-pointer hover:bg-gray-100' : ''}
              ${column.width ? '' : ''}
            `}
            style={{ width: column.width }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <div className="flex items-center">
              {column.label}
              {column.sortable && onSort && getSortIcon(column.key)}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
};

export default TableHeader;