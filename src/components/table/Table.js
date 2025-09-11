// src/components/ui/Table/Table.js
import React, { useState } from 'react';
import TableHeader from './TableHeader';
import TableBody from './TableBody';

const Table = ({
  data = [],
  columns = [],
  sortable = false,
  onSort,
  renderRow,
  emptyMessage = "No data available",
  className = "",
  containerClassName = "",
  loading = false,
  ...props
}) => {
  const [sortConfig, setSortConfig] = useState(null);

  const handleSort = (sortData) => {
    setSortConfig(sortData);
    if (onSort) {
      onSort(sortData);
    }
  };

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className={`overflow-hidden ${containerClassName}`}>
      <div className="overflow-x-auto">
        <table 
          className={`
            min-w-full bg-white border border-gray-200 rounded-lg
            ${className}
          `}
          {...props}
        >
          <TableHeader 
            columns={columns}
            onSort={sortable ? handleSort : null}
            sortConfig={sortConfig}
          />
          
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={columns.length}>
                  <LoadingSpinner />
                </td>
              </tr>
            </tbody>
          ) : (
            <TableBody 
              data={data}
              columns={columns}
              renderRow={renderRow}
              emptyMessage={emptyMessage}
            />
          )}
        </table>
      </div>
    </div>
  );
};

export default Table;