// src/components/dashboard/SimpleTable.jsx
import React from "react";

export default function SimpleTable({ columns, data, emptyMessage = "Tidak ada data" }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <div className="inline-block min-w-full align-middle px-5">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    col.align === "right" ? "text-right" : ""
                  } ${col.width || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col, colIdx) => {
                    let value = row[col.key];
                    if (col.render) value = col.render(value, row, idx);
                    return (
                      <td
                        key={colIdx}
                        className={`px-3 py-3 text-sm text-slate-900 ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
