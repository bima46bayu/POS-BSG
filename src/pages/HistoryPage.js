import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, PackageSearch } from "lucide-react";
import { HistoryByTransaction, HistoryByItem } from "../components/history";

const TAB_KEY = "history_active_tab";
const TABS = [
  { id: "tx", label: "Transactions", icon: CalendarClock },
  { id: "item", label: "By Item", icon: PackageSearch },
];

export default function HistoryPage() {
  const [sp, setSp] = useSearchParams();
  const active = sp.get("tab") || localStorage.getItem(TAB_KEY) || "tx";
  const current = useMemo(() => (TABS.some(t => t.id === active) ? active : "tx"), [active]);

  useEffect(() => {
    if (sp.get("tab") !== current) {
      sp.set("tab", current);
      setSp(sp, { replace: true });
    }
    localStorage.setItem(TAB_KEY, current);
  }, [current]);

  const setTab = (id) => {
    const next = TABS.some(t => t.id === id) ? id : "tx";
    localStorage.setItem(TAB_KEY, next);
    sp.set("tab", next);
    setSp(sp, { replace: false });
  };

  const ActiveIcon = TABS.find(t => t.id === current)?.icon ?? CalendarClock;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2">
        <ActiveIcon className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">History</h2>
      </div>

      {/* Wizard Tabs */}
      <div className="bg-white mt-4 p-2 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = current === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition " +
                  (isActive
                    ? "bg-blue-600 text-white border-blue-600 shadow"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
                }
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body per tab */}
      <div className="mt-4">
        {current === "tx" ? <HistoryByTransaction /> : <HistoryByItem />}
      </div>
    </div>
  );
}
