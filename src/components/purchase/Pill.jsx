import React from "react";
export default function Pill({ children, variant = "default" }) {
  const cls =
    variant === "success"
      ? "bg-green-100 text-green-800 border border-green-200"
      : variant === "warn"
      ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
      : variant === "danger"
      ? "bg-red-100 text-red-800 border border-red-200"
      : "bg-gray-100 text-gray-800 border border-gray-200";
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}
