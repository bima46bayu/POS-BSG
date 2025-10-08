// src/components/purchase/PoBySupplierTable.jsx
import React, { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { listPurchases, getPurchase } from "../../api/purchases";
import DataTable from "../data-table/DataTable";
import { Check, X as XIcon, Eye, Calendar, Loader2 } from "lucide-react";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const formatDateTime = (s) =>
  s
    ? new Date(s).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// ===== NEW: normalisasi status dan style =====
function normalizeStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();

  if (s === "approved") return "approved";
  if (s.includes("cancel")) return "canceled"; // cancelled/canceled
  if (["closed", "received", "completed", "done", "finished"].includes(s)) return "closed";
  if (["partial", "partially_received", "in_progress", "progress"].includes(s)) return "partial_gr";
  if (s === "pending") return "pending";
  // default fallback
  return "draft";
}

const STATUS_STYLE = {
  closed: "bg-gray-100 text-gray-800 border-gray-200",
  pending: "bg-gray-100 text-gray-800 border-gray-200",
  partial_gr: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  canceled: "bg-rose-100 text-rose-800 border-rose-200",
  draft: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function PoBySupplierTable({
  search,
  filters,
  page,
  setPage,
  onApprovePO,
  onCancelPO,
  onDetailPO,
  actingId,
  fetchDetail = true,
}) {
  const { data: list, isLoading: listLoading } =
    useQueries({
      queries: [
        {
          queryKey: ["purchases", { ...filters, search, page }],
          queryFn: () => listPurchases({ ...filters, search, page }),
          keepPreviousData: true,
        },
      ],
    })[0] || {};

  const baseRows = Array.isArray(list) ? list : list?.data || [];
  const metaFromList = (!Array.isArray(list) && list?.meta) || null;

  const detailQueries = useQueries({
    queries: fetchDetail
      ? baseRows.map((po) => ({
          queryKey: ["purchase", po.id],
          queryFn: () => getPurchase(po.id),
        }))
      : [],
  });

  const isLoadingDetails = fetchDetail ? detailQueries.some((q) => q.isLoading) : false;
  const rows = useMemo(
    () => (fetchDetail ? detailQueries.map((q, i) => q.data || baseRows[i]).filter(Boolean) : baseRows),
    [fetchDetail, detailQueries, baseRows]
  );

  const getTotals = (row) => {
    let qtyOrder = num(row.qty_order);
    let totalPrice = row.grand_total ?? row.total ?? row.total_price ?? row.subtotal ?? null;
    if (Array.isArray(row.items)) {
      qtyOrder = row.items.reduce((s, it) => s + num(it.qty_order), 0);
      if (totalPrice == null) totalPrice = row.items.reduce((s, it) => s + num(it.price) * num(it.qty_order), 0);
    }
    return { qtyOrder, totalPrice: totalPrice ?? 0 };
  };

  const columns = useMemo(
    () => [
      {
        key: "purchase_number",
        header: "PO NUMBER",
        width: "150px",
        sticky: "left",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => r.purchase_number || `PO#${r.id}`,
      },
      {
        key: "created_at",
        header: "TANGGAL DIBUAT",
        width: "160px",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {formatDateTime(r.created_at)}
          </div>
        ),
      },
      {
        key: "supplier",
        header: "SUPPLIER",
        width: "180px",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => r?.supplier?.name || (r.supplier_id ? `#${r.supplier_id}` : "-"),
      },
      {
        key: "total_price",
        header: "TOTAL HARGA",
        width: "120px",
        align: "right",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => formatIDR(getTotals(r).totalPrice),
      },
      {
        key: "qty_order",
        header: "TOTAL ORDER",
        width: "90px",
        align: "right",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => getTotals(r).qtyOrder.toLocaleString("id-ID"),
      },
      {
        key: "status",
        header: "STATUS",
        width: "120px",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => {
          const st = normalizeStatus(r?.status);
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[st] || STATUS_STYLE.draft}`}>
              {st}
            </span>
          );
        },
      },
      {
        key: "__actions",
        header: "AKSI",
        sticky: "right",
        width: "190px",
        align: "center",
        thClassName: "px-2 py-2",
        tdClassName: "px-0 py-0",
        cell: (r) => {
          const st = normalizeStatus(r?.status);
          const isDraft = st === "draft" || st === "pending";
          const busy = actingId === r.id;

          return (
            <div className="sticky right-0 bg-white border-l border-gray-200 flex items-center justify-center gap-1 px-2 py-1.5">
              {isDraft && (
                <>
                  <button
                    onClick={() => onApprovePO?.(r)}
                    disabled={busy}
                    className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Approve"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onCancelPO?.(r)}
                    disabled={busy}
                    className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Tolak"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XIcon className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
              <button
                onClick={() => onDetailPO?.(r)}
                className="px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                title="Detail"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [actingId, onApprovePO, onCancelPO, onDetailPO]
  );

  const meta = useMemo(() => {
    if (metaFromList) return metaFromList;
    return { current_page: page || 1, last_page: page || 1, per_page: rows.length, total: rows.length };
  }, [metaFromList, page, rows.length]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full inline-block align-middle">
          <DataTable
            columns={columns}
            data={rows}
            loading={listLoading || isLoadingDetails}
            meta={meta}
            currentPage={meta.current_page}
            onPageChange={setPage}
            stickyHeader
            getRowKey={(r, i) => r.id ?? r.purchase_number ?? i}
            className="text-[13px]"
          />
        </div>
      </div>
    </div>
  );
}
