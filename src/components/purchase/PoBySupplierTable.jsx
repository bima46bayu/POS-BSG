// =============================
// src/components/purchase/PoBySupplierTable.jsx
// =============================
import React, { useMemo } from "react";
import { Calendar, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPurchases } from "../../api/purchases";
import { DataTable } from "../data-table";
import Pill from "./Pill";

// helper angka aman
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// hitung sisa (remain) aman dari NaN
function getRemainCount(row) {
  if (!row) return 0;
  if (row.total_remain != null) return Number(row.total_remain);

  if (Array.isArray(row.items)) {
    return row.items.reduce((sum, it) => {
      const order = num(it.qty_order) ?? 0;
      const received = num(it.qty_received) ?? 0;
      return sum + Math.max(0, order - received);
    }, 0);
  }

  if (row.remain != null) return Number(row.remain);

  const order = num(row.qty_order) ?? 0;
  const received = num(row.qty_received) ?? 0;
  return Math.max(0, order - received);
}

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
        render: (v) => {
          const val = String(v ?? "").toLowerCase();
          const variant =
            val.includes("received")
              ? "success"
              : val === "approved"
              ? "default"
              : val === "cancelled" || val === "canceled"
              ? "danger"
              : "warn";
          return <Pill variant={variant}>{v}</Pill>;
        },
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
        minWidth: "320px",
        render: (_, row) => {
          const status = String(row?.status || "").toLowerCase();
          const isDraft = status === "draft";
          const isApproved = status === "approved";
          const isPartially = status === "partially_received";
          const isCancelled = status === "cancelled" || status === "canceled";

          const remain = getRemainCount(row);

          // aturan baru: GR HIJAU jika status approved/partially_received & remain > 0
          const canGR = !isCancelled && (isApproved || isPartially) && remain > 0;

          const showApprove = isDraft;  // tetap seperti aturanmu semula
          const showCancel = isDraft;   // tetap seperti aturanmu semula

          // tooltip GR yang lebih jelas
          const grTitle = isCancelled
            ? "PO dibatalkan"
            : remain <= 0
            ? "Sudah diterima semua"
            : isDraft
            ? "Approve PO terlebih dahulu"
            : "Goods Receipt";

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

              {/* Approve & Cancel (sesuai logic semula) */}
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

              {/* GR: selalu tampil; hijau kalau canGR, abu2 kalau tidak */}
              <button
                onClick={() => (canGR ? onGR?.(row) : null)}
                disabled={!canGR}
                className={`px-3 h-8 inline-flex items-center justify-center rounded-lg ${
                  canGR
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
                title={grTitle}
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
