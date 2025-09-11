// src/components/ui/Table/TableCell.js
import React from 'react';

const TableCell = ({ 
  children, 
  className = "", 
  align = "left",
  width,
  ...props 
}) => {
  const alignmentClass = {
    left: "text-left",
    center: "text-center", 
    right: "text-right"
  };

  return (
    <td 
      className={`
        px-4 py-3 text-sm text-gray-700 border-b border-gray-100
        ${alignmentClass[align]} 
        ${className}
      `}
      style={{ width }}
      {...props}
    >
      {children}
    </td>
  );
};

export default TableCell;