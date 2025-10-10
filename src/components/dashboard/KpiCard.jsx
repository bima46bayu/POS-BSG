// src/components/dashboard/KpiCard.jsx
import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function KpiCard({ title, value, delta, icon: Icon, trend }) {
  const showDelta = typeof delta === "number" && isFinite(delta);
  const isPositive = showDelta && delta >= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        {showDelta && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {trend && <p className="text-xs text-slate-500">{trend}</p>}
      </div>
    </div>
  );
}
