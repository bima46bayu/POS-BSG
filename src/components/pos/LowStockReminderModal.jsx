import React, { useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";

/** Products at or below this can-make / stock qty are "low". */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Build alert rows from POS product list.
 * Recipe products use availableToMake; stock-tracked use stock qty.
 */
export function buildLowStockAlerts(products, threshold = LOW_STOCK_THRESHOLD) {
  const rows = [];
  for (const p of products || []) {
    let qty = null;
    let kind = null;
    if (p.hasRecipe && p.availableToMake != null) {
      qty = Number(p.availableToMake);
      kind = "recipe";
    } else if (p.isStockTracked) {
      qty = Number(p.stock ?? 0);
      kind = "stock";
    }
    if (qty == null || qty > threshold) continue;
    rows.push({
      id: p.id,
      name: p.name,
      qty,
      kind,
      bottleneck: p.recipeBottleneck || null,
      critical: qty <= 0,
    });
  }
  rows.sort((a, b) => {
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return a.qty - b.qty || String(a.name).localeCompare(String(b.name));
  });
  return rows;
}

export default function LowStockReminderModal({
  open,
  alerts = [],
  onClose,
  storeLabel,
}) {
  const { outCount, lowCount } = useMemo(() => {
    let out = 0;
    let low = 0;
    for (const a of alerts) {
      if (a.critical) out += 1;
      else low += 1;
    }
    return { outCount: out, lowCount: low };
  }, [alerts]);

  if (!open || !alerts.length) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">
                Pengingat stok bahan rendah
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {storeLabel ? `${storeLabel} · ` : ""}
                {outCount > 0 ? `${outCount} habis` : null}
                {outCount > 0 && lowCount > 0 ? ", " : null}
                {lowCount > 0 ? `${lowCount} hampir habis` : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 text-sm text-gray-600 border-b bg-amber-50/60">
          Beberapa item tidak bisa dijual atau hampir habis karena stok bahan /
          inventory rendah. Segera lakukan GR atau cek resep.
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                a.critical
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {a.name}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {a.kind === "recipe"
                    ? a.bottleneck
                      ? `Bahan pembatas: ${a.bottleneck}`
                      : "Terbatas oleh resep / bahan"
                    : "Stok produk"}
                </div>
              </div>
              <div
                className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                  a.critical
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {a.kind === "recipe"
                  ? a.critical
                    ? "Can make 0"
                    : `Can make ${a.qty}`
                  : a.critical
                    ? "Habis"
                    : `Sisa ${a.qty}`}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
