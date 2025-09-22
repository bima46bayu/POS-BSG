import React from 'react';

const DataTableBody = ({ data, columns }) => {
  const renderCellContent = (item, column) => {
    if (column.render) {
      return column.render(item[column.key], item);
    }
    return item[column.key];
  };

  const getCellClass = (column) => {
    let baseClass = "px-6 py-4 text-sm whitespace-nowrap";
    
    // Add sticky classes with higher z-index for cells
    if (column.sticky === 'left') {
      baseClass += " sticky left-0 bg-white border-r border-gray-200 z-10";
    }
    if (column.sticky === 'right') {
      baseClass += " sticky right-0 bg-white border-l border-gray-200 z-10";
    }
    
    // Add alignment classes
    if (column.align === 'center') {
      baseClass += " text-center";
    } else if (column.align === 'right') {
      baseClass += " text-right";
    } else {
      baseClass += " text-left";
    }
    
    // Add custom className
    if (column.className) {
      baseClass += ` ${column.className}`;
    }
    
    return baseClass;
  };

  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {data.map((item, rowIndex) => (
        <tr
          key={rowIndex}
          className="hover:bg-gray-50 transition-colors"
        >
          {columns.map((column, colIndex) => (
            <td
              key={colIndex}
              className={getCellClass(column)}
            >
              {renderCellContent(item, column)}
            </td>
          ))}
        </tr>
      ))}
      {data.length === 0 && (
        <tr>
          <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
            <div className="flex flex-col items-center gap-2">
              <div className="text-gray-400">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v4.01" />
                </svg>
              </div>
              <p>No Data found</p>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
};

export default DataTableBody;