import React, { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { listPurchases, getPurchase } from "../../api/purchases";
import { DataTable } from "../../components/data-table";

function aggregateByProduct(purchaseDetails) {
  const map = new Map();
  purchaseDetails.forEach((po) => {
    (po.items || []).forEach((it) => {
      const key = it.product_id;
      const cur = map.get(key) || { product_id: it.product_id, product: it.product, qty_order: 0, qty_received: 0, suppliers: new Map() };
      cur.qty_order += Number(it.qty_order || 0);
      cur.qty_received += Number(it.qty_received || 0);
      const supId = po?.supplier?.id || po.supplier_id;
      const supName = po?.supplier?.name || `Supplier #${supId}`;
      const sup = cur.suppliers.get(supId) || { supplier_id: supId, name: supName, pos: [] };
      sup.pos.push({ id: po.id, purchase_number: po.purchase_number, qty_order: it.qty_order, qty_received: it.qty_received });
      cur.suppliers.set(supId, sup);
      map.set(key, cur);
    });
  });
  return Array.from(map.values()).map((row) => ({ ...row, suppliers: Array.from(row.suppliers.values()) }));
}

export default function PoByItemTable({ search, filters, page, setPage, onOpenSupplierBreakdown }) {
  const { data: list } = useQueries({
    queries: [
      { queryKey: ["purchases", { ...filters, search, page }], queryFn: () => listPurchases({ ...filters, search, page }), keepPreviousData: true },
    ],
  })[0] || {};

  const rows = Array.isArray(list) ? list : list?.data || [];
  const detailQueries = useQueries({ queries: rows.map((po) => ({ queryKey: ["purchase", po.id], queryFn: () => getPurchase(po.id) })) });
  const details = detailQueries.map((q, idx) => q.data || rows[idx]).filter(Boolean);

  const aggregated = useMemo(() => aggregateByProduct(details), [details]);

  const columns = useMemo(() => ([
    { key: "product.name", label: "Product", minWidth: "220px", render: (_, r) => r?.product?.name || `#${r.product_id}` },
    { key: "qty_order", label: "Total Ordered", align: "right", minWidth: "140px" },
    { key: "qty_received", label: "Total Received", align: "right", minWidth: "140px" },
    { key: "remain", label: "Remain", align: "right", minWidth: "120px", render: (_, r) => Number(r.qty_order - r.qty_received) },
    { key: "suppliers", label: "Suppliers", minWidth: "200px", render: (_, r) => (
      <button onClick={() => onOpenSupplierBreakdown?.(r)} className="text-blue-600 hover:underline">
        {r.suppliers.length} supplier(s)
      </button>
    ) },
  ]), [onOpenSupplierBreakdown]);

  return (
    <DataTable
      data={aggregated}
      columns={columns}
      title="Products from Purchases"
      searchable={false}
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      startIndex={1}
      endIndex={aggregated.length}
      totalItems={aggregated.length}
    />
  );
}
