import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, PackageSearch, Layers } from "lucide-react";
import {
  HistoryByTransaction,
  HistoryByItem,
  HistoryBySubcategoryMonth,
  HistoryByRegister,
} from "../components/history";
import { getMe } from "../api/users";
import { listStoreLocations } from "../api/storeLocations";
import StoreScopeFilter from "../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../hooks/useStoreScopeFilter";
import { canSwitchStores } from "../utils/roles";

const TAB_KEY = "history_active_tab";
const STORAGE_KEY = "history_store_id";
const PARENT_STORAGE_KEY = "history_parent_store_id";

const TABS = [
  { id: "tx", label: "Transactions", icon: CalendarClock },
  { id: "item", label: "By Item", icon: PackageSearch },
  { id: "subcat_month", label: "Subcategory / Month", icon: Layers },
  { id: "register", label: "Register", icon: CalendarClock },
];

export default function HistoryPage() {
  const [sp, setSp] = useSearchParams();
  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);

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
    branchStorageKey: STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await getMe();
        if (!cancelled) setMe(meRes);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me || !canSwitchStores(me?.role, me)) return;
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
  }, [me]);

  const active = sp.get("tab") || localStorage.getItem(TAB_KEY) || "tx";

  const current = useMemo(
    () => (TABS.some((t) => t.id === active) ? active : "tx"),
    [active]
  );

  useEffect(() => {
    if (sp.get("tab") !== current) {
      const next = new URLSearchParams(sp);
      next.set("tab", current);
      setSp(next, { replace: true });
    }
    localStorage.setItem(TAB_KEY, current);
  }, [current, sp, setSp]);

  const setTab = (id) => {
    const nextId = TABS.some((t) => t.id === id) ? id : "tx";
    localStorage.setItem(TAB_KEY, nextId);

    const next = new URLSearchParams(sp);
    next.set("tab", nextId);
    setSp(next, { replace: false });
  };

  const ActiveIcon =
    TABS.find((t) => t.id === current)?.icon ?? CalendarClock;

  const lockedLabel =
    me?.store_location?.name || activeStoreLabel || "Global";

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Kiri: title dan store */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <ActiveIcon className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-lg font-semibold text-gray-800">History</h2>
            </div>
            <StoreScopeFilter
              stores={stores}
              me={me}
              parentId={parentFilterId}
              branchId={storeFilterId}
              onParentChange={handleParentChange}
              onBranchChange={handleBranchChange}
              canPickStore={canPickStore}
              lockedLabel={lockedLabel}
            />
          </div>

          {/* Kanan: segmented tabs */}
          <div className="shrink-0">
            <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm gap-1.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = current === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={
                      "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap " +
                      (isActive
                        ? "bg-blue-600 text-white shadow"
                        : "bg-transparent text-gray-500 hover:bg-gray-50")
                    }
                  >
                    <Icon
                      className={
                        "w-4 h-4 " +
                        (isActive ? "text-white" : "text-gray-400")
                      }
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {needsStoreSelection && (
        <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Pilih parent dan cabang untuk melihat history cabang tersebut.
        </div>
      )}

      {/* Body per tab */}
      <div className="mt-4">
        {current === "tx" && (
          <HistoryByTransaction
            storeId={effectiveStoreId}
            needsStoreSelection={needsStoreSelection}
          />
        )}
        {current === "item" && (
          <HistoryByItem
            storeId={effectiveStoreId}
            needsStoreSelection={needsStoreSelection}
          />
        )}
        {current === "subcat_month" && (
          <HistoryBySubcategoryMonth
            storeId={effectiveStoreId}
            needsStoreSelection={needsStoreSelection}
          />
        )}
        {current === "register" && (
          <HistoryByRegister
            storeId={effectiveStoreId}
            needsStoreSelection={needsStoreSelection}
          />
        )}
      </div>
    </div>
  );
}
