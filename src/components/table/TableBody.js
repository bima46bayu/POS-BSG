// src/components/ui/Table/TableBody.js
import React from 'react';
import TableRow from './TableRow';
import TableCell from './TableCell';

const TableBody = ({ 
  data = [], 
  columns = [],
  renderRow,
  emptyMessage = "No data available",
  className = ""
}) => {
  // If custom row rendering is provided
  if (renderRow) {
    return (
      <tbody className={className}>
        {data.length === 0 ? (
          <tr>
            <td 
              colSpan={columns.length} 
              className="px-4 py-8 text-center text-gray-500 text-sm"
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, index) => renderRow(row, index))
        )}
      </tbody>
    );
  }

  // Default row rendering
  return (
    <tbody className={className}>
      {data.length === 0 ? (
        <tr>
          <td 
            colSpan={columns.length} 
            className="px-4 py-8 text-center text-gray-500 text-sm"
          >
            {emptyMessage}
          </td>
        </tr>
      ) : (
        data.map((row, rowIndex) => (
          <TableRow key={row.id || rowIndex}>
            {columns.map((column, colIndex) => (
              <TableCell 
                key={`${rowIndex}-${column.key || colIndex}`}
                align={column.align}
                width={column.width}
              >
                {column.render 
                  ? column.render(row[column.key], row, rowIndex)
                  : row[column.key]
                }
              </TableCell>
            ))}
          </TableRow>
        ))
      )}
    </tbody>
  );
};

export default TableBody;