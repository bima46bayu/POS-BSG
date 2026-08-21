// src/components/pos/OptionPickerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { rupiah } from "../../lib/fmt";
import { X } from "lucide-react";
import { sumOptionsPrice } from "../../api/productOptions";


/**
 * Modal pilih opsi item (Sugar Level, Ice Level, dll) sebelum masuk cart.
 *
 * Props:
 *  - open: boolean
 *  - product: normalized product (punya optionGroups)
 *  - onClose: () => void
 *  - onConfirm: (selected) => void
 *      selected = [{ group_id, group, value_id, name, price_delta }]
 */
export default function OptionPickerModal({
  open,
  product,
  onClose,
  onConfirm,
}) {
  const groups = useMemo(() => product?.optionGroups || [], [product]);

  // { [groupId]: number[] }  (array supaya MULTI & SINGLE seragam)
  const [picked, setPicked] = useState({});

  useEffect(() => {
    if (!open) return;

    // default: group SINGLE + required → pilih value pertama
    const init = {};
    for (const g of groups) {
      if (g.is_required && g.selection_type === "SINGLE" && g.values[0]) {
        init[g.id] = [g.values[0].id];
      } else {
        init[g.id] = [];
      }
    }
    setPicked(init);
  }, [open, groups]);

  const toggle = (group, valueId) => {
    setPicked((prev) => {
      const cur = prev[group.id] || [];

      if (group.selection_type === "MULTI") {
        return {
          ...prev,
          [group.id]: cur.includes(valueId)
            ? cur.filter((v) => v !== valueId)
            : [...cur, valueId],
        };
      }

      // SINGLE: klik ulang → uncheck (kecuali required)
      if (cur.includes(valueId)) {
        return { ...prev, [group.id]: group.is_required ? cur : [] };
      }
      return { ...prev, [group.id]: [valueId] };
    });
  };

  const selected = useMemo(() => {
    const out = [];
    for (const g of groups) {
      for (const vid of picked[g.id] || []) {
        const v = g.values.find((x) => x.id === vid);
        if (v) {
          out.push({
            group_id: g.id,
            group: g.name,
            value_id: v.id,
            name: v.name,
            price_delta: Number(v.price_delta || 0),
          });
        }
      }
    }
    return out;
  }, [groups, picked]);

  const missingRequired = useMemo(
    () =>
      groups
        .filter((g) => g.is_required && !(picked[g.id] || []).length)
        .map((g) => g.name),
    [groups, picked]
  );

  const extra = sumOptionsPrice(selected);
  const unitTotal = Number(product?.price || 0) + extra;

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-[121] w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[88vh] flex flex-col">
        {/* header */}
        <div className="px-5 py-3 border-b flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {product.name}
            </h3>
            <p className="text-xs text-gray-500">{rupiah(product.price)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4 overflow-y-auto space-y-5">
          {groups.map((g) => {
            const cur = picked[g.id] || [];
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {g.name}
                  </span>
                  {g.is_required ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                      wajib
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">opsional</span>
                  )}
                  {g.selection_type === "MULTI" && (
                    <span className="text-[10px] text-gray-400">
                      bisa pilih banyak
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {g.values.map((v) => {
                    const active = cur.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggle(g, v.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition ${
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center justify-center w-4 h-4 shrink-0 border ${
                              g.selection_type === "MULTI"
                                ? "rounded"
                                : "rounded-full"
                            } ${
                              active
                                ? "border-blue-600 bg-blue-600"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="truncate">{v.name}</span>
                        </span>
                        {Number(v.price_delta) !== 0 && (
                          <span className="text-xs shrink-0 ml-2">
                            {Number(v.price_delta) > 0 ? "+" : ""}
                            {rupiah(v.price_delta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t shrink-0 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Harga / item</span>
            <span className="font-semibold text-gray-900">
              {rupiah(unitTotal)}
              {extra > 0 && (
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (+{rupiah(extra)})
                </span>
              )}
            </span>
          </div>

          {missingRequired.length > 0 && (
            <p className="text-[11px] text-red-600">
              Pilih dulu: {missingRequired.join(", ")}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-xl text-sm"
            >
              Batal
            </button>
            <button
              onClick={() => onConfirm?.(selected)}
              disabled={missingRequired.length > 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Tambah ke Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
