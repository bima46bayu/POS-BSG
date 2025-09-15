import React from 'react';
import DataTableHeader from './DataTableHeader';
import DataTableBody from './DataTableBody';
import Pagination from './Pagination';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const DataTable = ({
  data = [],
  columns = [],
  title,
  searchable = true,
  searchTerm = '',
  onSearchChange,
  sortConfig = { key: null, direction: 'asc' },
  onSort,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  startIndex = 0,
  endIndex = 0,
  totalItems = 0,
  filterComponent,
  actions,
  className = ""
}) => {
  
  const getSortIcon = (column) => {
    if (!column.sortable || !onSort) return null;
    
    if (sortConfig.key === column.key) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="w-4 h-4" /> : 
        <ChevronDown className="w-4 h-4" />;
    }
    return <ChevronsUpDown className="w-4 h-4 text-gray-300" />;
  };

  const getHeaderAlignment = (column) => {
    // Jika ada headerAlign yang didefinisikan secara eksplisit, gunakan itu
    if (column.headerAlign) {
      return column.headerAlign;
    }
    
    // Jika ada align untuk cell, gunakan yang sama untuk header
    if (column.align) {
      return column.align;
    }
    
    // Auto-detect berdasarkan tipe data atau nama kolom
    const numericColumns = [
      'subTotal', 'pay', 'change', 'price', 'amount', 'total', 
      'qty', 'quantity', 'subtotal', 'discount', 'tax', 'balance',
      'cost', 'fee', 'rate', 'percentage', 'count', 'number', 'value'
    ];
    
    const columnLower = column.key.toLowerCase();
    const isNumeric = numericColumns.some(numeric => 
      columnLower.includes(numeric.toLowerCase())
    );
    
    if (isNumeric) {
      return 'right';
    }
    
    return 'left';
  };

  const getHeaderClass = (column) => {
    const alignment = getHeaderAlignment(column);
    let baseClass = "px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider";
    
    // Add alignment class
    switch (alignment) {
      case 'center':
        baseClass += " text-center";
        break;
      case 'right':
        baseClass += " text-right";
        break;
      default:
        baseClass += " text-left";
    }
    
    // Add sticky classes
    if (column.sticky === 'left') {
      baseClass += " sticky left-0 bg-gray-50 border-r border-gray-200 z-10";
    }
    if (column.sticky === 'right') {
      baseClass += " sticky right-0 bg-gray-50 border-l border-gray-200 z-10";
    }
    
    // Add sortable cursor
    if (column.sortable && onSort) {
      baseClass += " cursor-pointer hover:bg-gray-100 transition-colors";
    }
    
    // Add min width
    if (column.minWidth) {
      baseClass += ` min-w-[${column.minWidth}]`;
    }
    
    return baseClass;
  };

  const getFlexClass = (alignment) => {
    switch (alignment) {
      case 'center':
        return 'justify-center';
      case 'right':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <DataTableHeader
        title={title}
        searchable={searchable}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        filterComponent={filterComponent}
        actions={actions}
      />
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => {
                const alignment = getHeaderAlignment(column);
                return (
                  <th
                    key={column.key || index}
                    className={getHeaderClass(column)}
                    onClick={() => column.sortable && onSort && onSort(column.key)}
                  >
                    <div className={`flex items-center gap-2 ${getFlexClass(alignment)}`}>
                      {/* Icon di kiri untuk left/center alignment */}
                      {alignment !== 'right' && getSortIcon(column)}
                      <span className="select-none">{column.label}</span>
                      {/* Icon di kanan untuk right alignment */}
                      {alignment === 'right' && getSortIcon(column)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <DataTableBody data={data} columns={columns} />
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
      />
    </div>
  );
};

export default DataTable;