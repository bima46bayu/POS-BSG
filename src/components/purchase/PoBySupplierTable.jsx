// src/components/purchase/PoBySupplierTable.jsx
import React, { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// Normalisasi status → label konsisten
function normalizeStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s.includes("cancel")) return "canceled";
  if (["closed", "received", "completed", "done", "finished"].includes(s)) return "closed";
  if (["partial", "partially_received", "in_progress", "progress"].includes(s)) return "partial_gr";
  if (s === "pending") return "pending";
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
  perPage = 10,
}) {
  const queryClient = useQueryClient();

  // === 1) HANYA 1 FETCH UNTUK LIST ===
  const { data, isLoading: listLoading } = useQuery({
    queryKey: ["purchases", { ...filters, search: search ?? "", page, per_page: perPage }],
    queryFn: () => listPurchases({ ...filters, search, page, per_page: perPage }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Adapter: dukung 3 bentuk (normalized, laravel root, array)
  const items = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;                 // array murni (jarang)
    if (Array.isArray(data.items)) return data.items;     // normalized
    if (Array.isArray(data.data)) return data.data;       // laravel paginator root
    return [];
  }, [data]);

  const meta = useMemo(() => {
    if (!data) return { current_page: page || 1, last_page: 1, per_page: perPage, total: 0 };
    // normalized
    if (data.meta) return data.meta;
    // laravel root
    if (data.current_page != null) {
      return {
        current_page: Number(data.current_page ?? page ?? 1),
        per_page: Number(data.per_page ?? perPage),
        last_page: Number(data.last_page ?? 1),
        total: Number(data.total ?? items.length),
      };
    }
    // fallback
    return { current_page: page || 1, last_page: 1, per_page: perPage, total: items.length };
  }, [data, page, perPage, items.length]);

  // === 2) OPSIONAL: PREFETCH DETAIL SAAT HOVER TOMBOL DETAIL ===
  const prefetchDetail = useCallback(
    (id) => {
      queryClient.prefetchQuery({
        queryKey: ["purchase", id],
        queryFn: () => getPurchase(id),
        staleTime: 30_000,
      });
    },
    [queryClient]
  );

  // === 3) Kolom tabel pakai data yang SUDAH ada di list (cepat) ===
  const getTotals = (row) => {
    // gunakan field dari list yang sudah disiapkan backend
    // prefer grand_total → subtotal → total_price, dsb
    const totalPrice = num(row.grand_total ?? row.total ?? row.total_price ?? row.subtotal ?? 0);
    const qtyOrder =
      // dari index patch: qty_total (selectSub SUM(qty_order))
      num(row.qty_total) ||
      // fallback ke items_count kalau memang hanya ingin jumlah baris item (bukan total qty)
      num(row.items_count) ||
      0;
    return { qtyOrder, totalPrice };
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
        key: "order_date",
        header: "TANGGAL",
        width: "160px",
        tdClassName: "px-2 py-1.5",
        thClassName: "px-2 py-2",
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {formatDateTime(r.order_date ?? r.created_at)}
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
        width: "110px",
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
                onMouseEnter={() => prefetchDetail(r.id)}   // prefetch biar modal cepat
                onFocus={() => prefetchDetail(r.id)}
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
    [actingId, onApprovePO, onCancelPO, onDetailPO, prefetchDetail]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full inline-block align-middle">
          <DataTable
            columns={columns}
            data={items}
            loading={listLoading}
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
