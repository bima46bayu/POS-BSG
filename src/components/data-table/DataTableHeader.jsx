import React from 'react';
import { Search } from 'lucide-react';

const DataTableHeader = ({
  title,
  searchable,
  searchTerm,
  onSearchChange,
  filterComponent,
  actions
}) => {
  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {title && (
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        )}
        
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
              />
            </div>
          )}
          
          {filterComponent}
          {actions}
        </div>
      </div>
    </div>
  );
};

export default DataTableHeader;