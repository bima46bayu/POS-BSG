// src/components/dashboard/ChartCard.jsx
import React from "react";

export default function ChartCard({ title, children, className = "", action }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
