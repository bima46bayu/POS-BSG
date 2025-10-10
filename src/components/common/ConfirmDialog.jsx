// src/components/common/ConfirmDialog.jsx
import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Props:
 * - open: boolean
 * - title: string
 * - message: string | ReactNode
 * - confirmText?: string (default: "Delete")
 * - cancelText?: string (default: "Cancel")
 * - variant?: "danger" | "primary" (default: "danger")
 * - loading?: boolean
 * - loadingText?: string (default: confirmText + "...")
 * - onConfirm: () => void | Promise<void>
 * - onClose: () => void
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  loadingText,                              // ⬅️ new
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmBtnClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
      : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => !loading && onClose?.()} />

      {/* panel */}
      <div className="relative z-[201] w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {typeof message === "string" ? <p className="text-sm text-gray-700">{message}</p> : message}
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white focus:outline-none focus:ring-2 ${confirmBtnClass} disabled:opacity-60`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (loadingText || `${confirmText}...`) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
