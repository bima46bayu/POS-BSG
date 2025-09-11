// src/components/ui/Table/TableRow.js
import React from 'react';

const TableRow = ({ 
  children, 
  className = "",
  hover = true,
  selected = false,
  onClick,
  ...props 
}) => {
  return (
    <tr 
      className={`
        border-b border-gray-100 last:border-b-0
        ${hover ? 'hover:bg-gray-50' : ''}
        ${selected ? 'bg-blue-50' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
};

export default TableRow;