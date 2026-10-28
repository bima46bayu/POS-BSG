import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import DataTable from "../components/data-table/DataTable";
import StoreScopeFilter from "../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import { fetchCogsPerSku } from "../api/cogs";

const BRANCH_STORAGE_KEY = "cogs_sku_store_id";
const PARENT_STORAGE_KEY = "cogs_sku_parent_store_id";
const PER_PAGE = 20;

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const money = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const qty = (n) =>
  Number(n || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });

const pct = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

function compareRows(a, b, key, dir) {
  const av = a?.[key];
  const bv = b?.[key];
  const an = Number(av);
  const bn = Number(bv);
  let cmp = 0;
  if (Number.isFinite(an) && Number.isFinite(bn) && typeof av !== "string") {
    cmp = an - bn;
  } else {
    cmp = String(av ?? "").localeCompare(String(bv ?? ""), "id");
  }
  return dir === "desc" ? -cmp : cmp;
}

function IngredientBreakdown({ row }) {
  const lines = row.ingredients || [];
  if (!lines.length) {
    return (
      <p className="text-sm text-gray-500">
        {row.cost_source === "cost_price"
          ? "Stock SKU. Unit COGS is the catalog cost price."
          : "No active recipe, so this SKU has no standard unit cost."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Recipe for 1 {row.unit_name || "unit"}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500">
            <th className="py-1 pr-3">Ingredient</th>
            <th className="py-1 pr-3 text-right">Qty</th>
            <th className="py-1 pr-3 text-right">In stock unit</th>
            <th className="py-1 pr-3 text-right">Unit cost</th>
            <th className="py-1 text-right">Line cost</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.product_id} className="border-t border-gray-100">
              <td className="py-1.5 pr-3">
                <span className="font-medium text-gray-900">{line.name}</span>
                <span className="ml-2 text-gray-500">{line.sku}</span>
                {line.missing_cost && (
                  <span className="ml-2 text-xs text-amber-700">no cost price</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {qty(line.qty)} {line.unit_name || ""}
              </td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {qty(line.qty_stock)} {line.stock_unit || ""}
              </td>
              <td className="py-1.5 pr-3 text-right">{money(line.unit_cost)}</td>
              <td className="py-1.5 text-right">{money(line.line_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CogsPerSkuPage() {
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);
  const [from, setFrom] = useState(monthStartISO);
  const [to, setTo] = useState(todayISO);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("cogs");
  const [sortDir, setSortDir] = useState("desc");
  const [openId, setOpenId] = useState(null);

  const {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  } = useStoreScopeFilter({
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listStoreLocations({ page: 1, per_page: 200 });
        if (!cancelled) setStores(res?.items || []);
      } catch {
        if (!cancelled) setStores([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickStore]);

  const reportQ = useQuery({
    queryKey: ["cogs-per-sku", effectiveStoreId, from, to],
    queryFn: ({ signal }) =>
      fetchCogsPerSku(
        {
          store_location_id: effectiveStoreId,
          date_from: from || undefined,
          date_to: to || undefined,
        },
        signal
      ),
    enabled: effectiveStoreId != null,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = reportQ.data?.items || [];
    const rows = q
      ? items.filter((row) => {
          const sku = String(row.sku || "").toLowerCase();
          const name = String(row.name || "").toLowerCase();
          return sku.includes(q) || name.includes(q);
        })
      : items;
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [reportQ.data, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, effectiveStoreId, from, to, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.qty_sold += Number(row.qty_sold || 0);
        acc.revenue += Number(row.revenue || 0);
        acc.cogs += Number(row.cogs || 0);
        acc.gross_profit += Number(row.gross_profit || 0);
        if (row.missing_cost) acc.missing_cost_count += 1;
        return acc;
      },
      { qty_sold: 0, revenue: 0, cogs: 0, gross_profit: 0, missing_cost_count: 0 }
    );
  }, [filtered]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "sku" || key === "name" ? "asc" : "desc");
  };

  const columns = useMemo(
    () => [
      {
        key: "sku",
        header: "SKU",
        width: "140px",
        cell: (row) => (
          <button
            type="button"
            onClick={() => setOpenId((id) => (id === row.product_id ? null : row.product_id))}
            className="inline-flex items-center gap-1 font-medium text-gray-900"
          >
            {openId === row.product_id ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            {row.sku || "—"}
          </button>
        ),
      },
      {
        key: "name",
        header: "Product",
        cell: (row) => (
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-xs text-gray-500">
              {row.cost_source === "recipe" && "Recipe"}
              {row.cost_source === "cost_price" && "Stock cost"}
              {row.cost_source === "none" && "No cost"}
              {row.missing_cost ? " · cost missing" : ""}
            </div>
          </div>
        ),
      },
      {
        key: "sell_price",
        header: "Sell price",
        align: "right",
        cell: (row) => money(row.sell_price),
      },
      {
        key: "unit_cogs",
        header: "Unit COGS",
        align: "right",
        cell: (row) => (row.unit_cogs == null ? "—" : money(row.unit_cogs)),
      },
      {
        key: "margin_pct",
        header: "Margin",
        align: "right",
        cell: (row) => pct(row.margin_pct),
      },
      {
        key: "qty_sold",
        header: "Qty sold",
        align: "right",
        cell: (row) => qty(row.qty_sold),
      },
      {
        key: "cogs",
        header: "COGS",
        align: "right",
        cell: (row) => money(row.cogs),
      },
      {
        key: "revenue",
        header: "Revenue",
        align: "right",
        cell: (row) => money(row.revenue),
      },
      {
        key: "gross_profit",
        header: "Gross profit",
        align: "right",
        cell: (row) => money(row.gross_profit),
      },
    ],
    [openId]
  );

  const errorMessage =
    reportQ.error?.response?.data?.message ||
    (reportQ.isError ? "Could not load COGS." : "");

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold">COGS per SKU</h2>
        <p className="text-sm text-gray-500">
          Unit COGS is the cost of one unit from the active recipe, or the catalog cost for a stock SKU.
          COGS, revenue, and gross profit are completed sales in the selected period. Recipe sales
          count the ingredient FIFO cost on the SKU that was sold.
        </p>
        <div className="mt-3">
          <StoreScopeFilter
            stores={stores}
            me={me}
            parentId={parentFilterId}
            branchId={storeFilterId}
            onParentChange={handleParentChange}
            onBranchChange={handleBranchChange}
            canPickStore={canPickStore}
            lockedLabel={activeStoreLabel}
          />
        </div>
      </div>

      {needsStoreSelection && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Select a parent store and a branch. Unit cost comes from that branch&apos;s recipes.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["SKUs", qty(filtered.length)],
          ["Qty sold", qty(totals.qty_sold)],
          ["COGS", money(totals.cogs)],
          ["Gross profit", money(totals.gross_profit)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border rounded-lg px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {totals.missing_cost_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          {totals.missing_cost_count} SKU{totals.missing_cost_count === 1 ? "" : "s"}{" "}
          {totals.missing_cost_count === 1 ? "is" : "are"} missing a cost price, so unit COGS is incomplete.
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600 flex-1 min-w-[200px]">
          Search
          <span className="mt-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU or product name"
              className="w-full text-sm outline-none"
            />
          </span>
        </label>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errorMessage}
        </div>
      )}

      <DataTable
        columns={columns}
        data={needsStoreSelection ? [] : pageRows}
        loading={reportQ.isLoading && effectiveStoreId != null}
        emptyText={
          needsStoreSelection ? "Select a branch to count COGS." : "No SKUs for this store."
        }
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        meta={{
          current_page: safePage,
          last_page: pageCount,
          per_page: PER_PAGE,
          total: filtered.length,
        }}
        currentPage={safePage}
        onPageChange={setPage}
        getRowKey={(row) => row.product_id}
        isRowExpanded={(row) => openId === row.product_id}
        renderExpandedRow={(row) => <IngredientBreakdown row={row} />}
        maxHeight="65vh"
      />
    </div>
  );
}
