import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, PackageSearch, Layers } from "lucide-react";
import {
  HistoryByTransaction,
  HistoryByItem,
  HistoryBySubcategoryMonth,
} from "../components/history";
import { getMe } from "../api/users";

const TAB_KEY = "history_active_tab";

const TABS = [
  { id: "tx", label: "Transactions", icon: CalendarClock },
  { id: "item", label: "By Item", icon: PackageSearch },
  { id: "subcat_month", label: "Subcategory / Month", icon: Layers },
];

export default function HistoryPage() {
  const [sp, setSp] = useSearchParams();
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await getMe();
        setMe(meRes);
      } catch {
        // ignore
      }
    })();
  }, []);

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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
          {/* Kiri: title dan store */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ActiveIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">History</h2>
            </div>
            <p className="text-xs text-gray-500">
              Store aktif:{" "}
              <span className="font-medium">
                {me?.store_location?.name || "Global"}
              </span>
            </p>
          </div>

          {/* Kanan: segmented tabs */}
          <div>
            <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm grid grid-cols-3 gap-1.5 min-w-[480px]">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = current === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={
                      "flex-1 basis-0 inline-flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition " +
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

      {/* Body per tab */}
      <div className="mt-4">
        {current === "tx" && <HistoryByTransaction />}
        {current === "item" && <HistoryByItem />}
        {current === "subcat_month" && <HistoryBySubcategoryMonth />}
      </div>
    </div>
  );
}
