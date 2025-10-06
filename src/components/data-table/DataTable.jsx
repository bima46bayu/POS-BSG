import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * DataTable (headerless)
 *
 * Props:
 * - columns: Array<{
 *     key: string,
 *     header: string | ReactNode,
 *     accessor?: (row) => any,        // default: row[key]
 *     cell?: (row) => ReactNode,
 *     align?: 'left'|'center'|'right',
 *     width?: string,                  // e.g. '140px'
 *     sticky?: 'left'|'right',
 *     className?: string,
 *   }>
 * - data: any[]
 * - loading?: boolean
 * - emptyText?: string
 *
 * - sortKey?: string|null
 * - sortDir?: 'asc'|'desc'
 * - onSort?: (key) => void
 *
 * - meta?: { current_page, last_page, per_page, total }
 * - currentPage?: number
 * - onPageChange?: (page) => void
 *
 * - renderActions?: (row) => ReactNode    // kolom aksi (sticky right)
 * - getRowKey?: (row, index) => string
 *
 * - stickyHeader?: boolean                 // default true
 * - maxHeight?: string                     // e.g. '60vh' untuk scroll vertikal
 * - className?: string
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyText = "No data found",

  sortKey = null,
  sortDir = "asc",
  onSort,

  meta = { current_page: 1, last_page: 1, per_page: 10, total: 0 },
  currentPage = 1,
  onPageChange,

  renderActions,
  getRowKey,

  stickyHeader = true,
  maxHeight, // optional → aktifkan scroll Y
  className = "",
}) {
  const startIndex = (meta?.current_page - 1) * (meta?.per_page || 10);
  const endIndex = Math.min(meta?.current_page * (meta?.per_page || 10), meta?.total || data.length);

  const hasStickyLeft = columns.some((c) => c.sticky === "left");
  const hasStickyRight = columns.some((c) => c.sticky === "right") || !!renderActions;

  const thBase =
    "px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200";
  const tdBase =
    "px-4 py-3 text-sm text-gray-900 whitespace-nowrap bg-white border-b border-gray-100";
  const alignClass = (a) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const stickyClass = (side) =>
    side === "left" ? "sticky left-0 z-10" : side === "right" ? "sticky right-0 z-10" : "";

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* wrapper scroll */}
      <div
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr>
              {columns.map((col, idx) => {
                const sortable = !!onSort && col.key;
                const isActive = sortKey === col.key;
                const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
                const style = col.width ? { width: col.width, minWidth: col.width } : undefined;

                // header cell
                const baseClass = `${thBase} ${alignClass(col.align)} ${col.className || ""}`;
                const stickyHeaderClass = stickyHeader ? "sticky top-0 z-20" : "";
                const stickyColClass = col.sticky
                  ? `${stickyClass(col.sticky)} ${stickyHeader ? "z-30" : ""} ${
                      col.sticky === "left"
                        ? hasStickyLeft ? "border-r border-gray-200" : ""
                        : hasStickyRight ? "border-l border-gray-200" : ""
                    }`
                  : "";

                return (
                  <th
                    key={idx}
                    className={`${baseClass} ${stickyHeaderClass} ${stickyColClass}`}
                    style={style}
                  >
                    {sortable ? (
                      <button
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900"
                        title={`Sort ${nextDir}`}
                      >
                        <span className="truncate">{col.header}</span>
                        {isActive ? (
                          <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
                        ) : (
                          <span className="text-xs opacity-40">↕</span>
                        )}
                      </button>
                    ) : (
                      <span className="truncate">{col.header}</span>
                    )}
                  </th>
                );
              })}

              {renderActions && (
                <th
                  className={`${thBase} text-center ${stickyHeader ? "sticky top-0 z-20" : ""} ${stickyClass("right")} ${
                    hasStickyRight ? "border-l border-gray-200" : ""
                  }`}
                  style={{ minWidth: "120px" }}
                >
                  Action
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500">Loading...</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && (!data || data.length === 0) && (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            )}

            {!loading &&
              data?.map((row, i) => {
                const rowKey = getRowKey ? getRowKey(row, i) : row.id ?? i;
                return (
                  <tr key={rowKey} className="hover:bg-gray-50 transition-colors">
                    {columns.map((col, ci) => {
                      const style = col.width ? { width: col.width, minWidth: col.width } : undefined;
                      const value = col.accessor ? col.accessor(row) : row[col.key];
                      const content = col.cell ? col.cell(row) : value;

                      return (
                        <td
                          key={`${rowKey}-${ci}`}
                          className={`${tdBase} ${alignClass(col.align)} ${col.className || ""} ${
                            col.sticky
                              ? `${stickyClass(col.sticky)} ${
                                  col.sticky === "left"
                                    ? hasStickyLeft ? "border-r border-gray-200" : ""
                                    : hasStickyRight ? "border-l border-gray-200" : ""
                                }`
                              : ""
                          }`}
                          style={style}
                        >
                          {content}
                        </td>
                      );
                    })}

                    {renderActions && (
                      <td
                        className={`${tdBase} text-center ${stickyClass("right")} ${
                          hasStickyRight ? "border-l border-gray-200" : ""
                        }`}
                        style={{ minWidth: "120px" }}
                      >
                        {renderActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer (opsional) */}
      {(onPageChange || meta) && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1 || 0}</span> to{" "}
            <span className="font-medium">{endIndex || 0}</span> of{" "}
            <span className="font-medium">{meta?.total ?? data.length}</span> results
          </div>

          {typeof onPageChange === "function" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700">
                Page {meta?.current_page || currentPage} of {meta?.last_page || 1}
              </span>
              <button
                onClick={() => onPageChange(Math.min(meta?.last_page || currentPage + 1, currentPage + 1))}
                disabled={(meta?.last_page || 1) <= currentPage}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
