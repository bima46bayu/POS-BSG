// Compact top bar — replaces the left Sidebar in the Odoo-style apps UX
import React from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, LogOut } from "lucide-react";

export default function AppsTopBar({ onLogout, title }) {
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-3 shadow-sm md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/home"
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          title="All apps"
        >
          <LayoutGrid size={18} className="text-gray-600" />
          <span className="hidden sm:inline">Apps</span>
        </Link>
        {title ? (
          <>
            <span className="hidden text-gray-300 sm:inline">/</span>
            <span className="truncate text-sm font-semibold text-gray-800">
              {title}
            </span>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </header>
  );
}
