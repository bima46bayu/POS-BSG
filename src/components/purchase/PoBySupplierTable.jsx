// =============================
// src/components/purchase/PoBySupplierTable.jsx
// =============================
import React, { useMemo } from "react";
import { Calendar, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPurchases } from "../../api/purchases";
import { DataTable } from "../../components/data-table";
import Pill from "./Pill";

export default function PoBySupplierTable({
  search,
  filters,
  page,
  setPage,
  onDetail,
  onGR,
  onApprove,
  onCancel,
  onSort,
}) {
  const params = { ...filters, search, page };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchases", params],
    queryFn: () => listPurchases(params),
    keepPreviousData: true,
  });

  // Normalize response
  const rows = Array.isArray(data) ? data : data?.data || [];
  const currentPage = Array.isArray(data) ? 1 : data?.current_page || 1;
  const total = Array.isArray(data) ? rows.length : data?.total || rows.length;
  const perPage = Array.isArray(data) ? rows.length : data?.per_page || 10;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const columns = useMemo(
    () => [
      {
        key: "purchase_number",
        label: "PO Number",
        sticky: "left",
        sortable: true,
        minWidth: "180px",
        className: "font-medium text-gray-900",
      },
      {
        key: "order_date",
        label: "Order Date",
        sortable: true,
        minWidth: "150px",
        render: (v) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{v}</span>
          </div>
        ),
      },
      {
        key: "supplier.name",
        label: "Supplier",
        sortable: false,
        minWidth: "160px",
        render: (_, row) => row?.supplier?.name || "-",
      },
      {
        key: "status",
        label: "Status",
        minWidth: "140px",
        render: (v) => (
          <Pill
            variant={
              v?.includes("received")
                ? "success"
                : v === "approved"
                ? "default"
                : v === "cancelled"
                ? "danger"
                : "warn"
            }
          >
            {v}
          </Pill>
        ),
      },
      {
        key: "grand_total",
        label: "Grand Total",
        align: "right",
        minWidth: "140px",
        render: (v) => (
          <span className="font-medium">
            {Number(v || 0).toLocaleString("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            })}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Action",
        sticky: "right",
        align: "center",
        minWidth: "280px",
        render: (_, row) => {
          const isDraft = row.status === "draft";
          const isApproved = row.status === "approved";
          const isCancelled = row.status === "cancelled";

          const showApprove = isDraft; // hanya saat draft
          const showCancel = isDraft; // hanya saat draft
          const canGR = isApproved; // GR hanya saat approved

          return (
            <div className="flex items-center justify-center gap-1">
              {/* Detail selalu ada */}
              <button
                onClick={() => onDetail?.(row)}
                className="px-3 h-8 inline-flex items-center justify-center border rounded-lg bg-white hover:bg-gray-50"
                title="Detail"
              >
                Detail
              </button>

              {/* Approve & Cancel hanya ketika draft */}
              {showApprove && (
                <button
                  onClick={() => onApprove?.(row)}
                  className="px-3 h-8 inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  title="Approve"
                >
                  Approve
                </button>
              )}
              {showCancel && (
                <button
                  onClick={() => onCancel?.(row)}
                  className="px-3 h-8 inline-flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700"
                  title="Cancel"
                >
                  Cancel
                </button>
              )}

              {/* GR: ditampilkan selalu, tapi disabled jika belum approved atau cancelled */}
              <button
                onClick={() => onGR?.(row)}
                disabled={!canGR}
                className={`px-3 h-8 inline-flex items-center justify-center rounded-lg ${
                  canGR
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
                title={
                  isCancelled
                    ? "PO dibatalkan"
                    : isDraft
                    ? "Approve PO terlebih dahulu"
                    : "Goods Receipt"
                }
              >
                <Package className="w-4 h-4 mr-1" /> GR
              </button>
            </div>
          );
        },
      },
    ],
    [onDetail, onApprove, onCancel, onGR]
  );

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-600">Failed to load purchases.</div>;

  return (
    <DataTable
      data={rows}
      columns={columns}
      title="Purchase Orders"
      searchable={false}
      searchTerm={search}
      onSearchChange={() => {}}
      sortConfig={{ key: null, direction: "asc" }}
      onSort={onSort}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setPage}
      startIndex={(currentPage - 1) * perPage + 1}
      endIndex={Math.min(currentPage * perPage, total)}
      totalItems={total}
    />
  );
}
