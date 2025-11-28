// src/components/purchase/PoByItemTable.jsx
import React, { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { listPurchases, getPurchase } from "../../api/purchases";
import DataTable from "../data-table/DataTable";

function aggregateByProduct(purchaseDetails) {
  const map = new Map();
  purchaseDetails.forEach((po) => {
    (po.items || []).forEach((it) => {
      const key = it.product_id;
      const cur = map.get(key) || {
        product_id: it.product_id,
        product: it.product,
        qty_order: 0,
        qty_received: 0,
        suppliers: new Map(),
      };
      cur.qty_order += Number(it.qty_order || 0);
      cur.qty_received += Number(it.qty_received || 0);

      const supId = po?.supplier?.id || po.supplier_id;
      const supName = po?.supplier?.name || `Supplier #${supId}`;
      const sup = cur.suppliers.get(supId) || {
        supplier_id: supId,
        name: supName,
        pos: [],
      };
      sup.pos.push({
        id: po.id,
        purchase_number: po.purchase_number,
        qty_order: it.qty_order,
        qty_received: it.qty_received,
      });
      cur.suppliers.set(supId, sup);
      map.set(key, cur);
    });
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    suppliers: Array.from(row.suppliers.values()),
  }));
}

const formatNumber = (n) => Number(n ?? 0).toLocaleString("id-ID");

export default function PoByItemTable({
  search,
  filters,
  page,
  setPage,
  onOpenSupplierBreakdown,
}) {
  // Fetch purchase list (paginated)
  const { data: list, isLoading: listLoading } =
    useQueries({
      queries: [
        {
          queryKey: [
            "purchases",
            { ...(filters || {}), search: search ?? "", page },
          ],
          queryFn: () =>
            listPurchases({
              ...(filters || {}),
              search,
              page,
            }),
          keepPreviousData: true,
        },
      ],
    })[0] || {};

  // Normalize rows (list bisa berupa array atau {data, meta})
  const rowsRaw = Array.isArray(list) ? list : list?.data || [];
  const metaFromList = (!Array.isArray(list) && list?.meta) || null;

  // CLIENT filter per user_id
  const rows = useMemo(() => {
    if (!filters?.user_id) return rowsRaw;
    const uid = String(filters.user_id);
    return rowsRaw.filter((po) => String(po.user_id ?? "") === uid);
  }, [rowsRaw, filters]);

  // Fetch details untuk setiap purchase (agar bisa agregasi per item)
  const detailQueries = useQueries({
    queries: rows.map((po) => ({
      queryKey: ["purchase", po.id],
      queryFn: () => getPurchase(po.id),
    })),
  });

  const details = detailQueries
    .map((q, idx) => q.data || rows[idx])
    .filter(Boolean);
  const isLoadingDetails = detailQueries.some((q) => q.isLoading);

  const aggregated = useMemo(() => aggregateByProduct(details), [details]);

  // Kolom untuk DataTable
  const columns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        width: "260px",
        cell: (row) => row?.product?.name || `#${row.product_id}`,
      },
      {
        key: "qty_order",
        header: "Total Ordered",
        width: "140px",
        align: "right",
        cell: (row) => formatNumber(row.qty_order),
      },
      {
        key: "qty_received",
        header: "Total Received",
        width: "140px",
        align: "right",
        cell: (row) => formatNumber(row.qty_received),
      },
      {
        key: "remain",
        header: "Remain",
        width: "120px",
        align: "right",
        cell: (row) => formatNumber(Number(row.qty_order - row.qty_received)),
      },
      {
        key: "suppliers",
        header: "Suppliers",
        width: "200px",
        cell: (row) => (
          <button
            onClick={() => onOpenSupplierBreakdown?.(row)}
            className="text-blue-600 hover:underline text-sm"
          >
            {row.suppliers.length} supplier(s)
          </button>
        ),
      },
    ],
    [onOpenSupplierBreakdown]
  );

  // Meta/pagination fallback (kalau API tidak kirim meta)
  const meta = useMemo(() => {
    if (metaFromList) return metaFromList;
    return {
      current_page: page || 1,
      last_page: page || 1,
      per_page: aggregated.length || 0,
      total: aggregated.length || 0,
    };
  }, [metaFromList, page, aggregated.length]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            <DataTable
              columns={columns}
              data={aggregated}
              loading={listLoading || isLoadingDetails}
              meta={meta}
              currentPage={meta.current_page}
              onPageChange={setPage}
              stickyHeader
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
