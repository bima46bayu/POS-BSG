import React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

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

{/* Pagination footer */}
{(onPageChange || meta) && (
  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
    {/* kiri: info showing */}
    <div className="text-sm text-gray-700">
      Showing{" "}
      <span className="font-medium">
        {startIndex != null ? startIndex + 1 : 0}
      </span>{" "}
      to{" "}
      <span className="font-medium">
        {endIndex != null ? endIndex : 0}
      </span>{" "}
      of{" "}
      <span className="font-medium">
        {meta?.total ?? data.length}
      </span>{" "}
      results
    </div>

    {/* kanan: pager */}
    {typeof onPageChange === "function" && (
      (() => {
        const perPage =
          meta?.per_page ??
          ((endIndex != null && startIndex != null && endIndex > startIndex)
            ? (endIndex - startIndex)
            : 10); // fallback aman

        const totalItems = meta?.total ?? data.length;
        const computedTotalPages = Math.max(
          1,
          meta?.last_page ?? Math.ceil(totalItems / Math.max(1, perPage))
        );

        const page = meta?.current_page || currentPage || 1;

        const handleGoToPage = (e) => {
          const val = parseInt(e.target.value, 10);
          if (val > 0 && val <= computedTotalPages) {
            onPageChange(val);
            e.target.value = '';
          }
        };

        return (
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value=""
                onChange={handleGoToPage}
                className="pl-3 pr-9 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer appearance-none"
                title="Go to page"
              >
                <option value="">Page {page}</option>
                {Array.from({ length: computedTotalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Page {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1.5 text-sm text-gray-700">
              Page {page} of {computedTotalPages}
            </span>

            <button
              onClick={() => onPageChange(Math.min(computedTotalPages, page + 1))}
              disabled={page >= computedTotalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        );
      })()
    )}
  </div>
)}

    </div>
  );
}
