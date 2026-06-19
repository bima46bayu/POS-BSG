import React, { useMemo } from "react";
import {
  branchStoresForParent,
  storeLabel,
  visibleParentStores,
} from "../../utils/storeScope";

/**
 * Two-level store picker: Parent Store → Branch Store.
 */
export default function StoreScopeFilter({
  stores = [],
  me,
  parentId = "",
  branchId = "",
  onParentChange,
  onBranchChange,
  canPickStore = false,
  lockedLabel,
  parentLabel = "Parent Store",
  branchLabel = "Branch Store",
  parentPlaceholder = "— Pilih parent —",
  branchPlaceholder = "— Pilih cabang —",
  className = "",
}) {
  const parentOptions = useMemo(
    () => visibleParentStores(stores, me),
    [stores, me]
  );

  const branchOptions = useMemo(
    () => branchStoresForParent(stores, parentId, me),
    [stores, parentId, me]
  );

  if (!canPickStore) {
    return (
      <p className={`text-xs text-gray-500 ${className}`.trim()}>
        Cabang:{" "}
        <span className="font-medium">{lockedLabel || storeLabel(stores, branchId)}</span>
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`.trim()}>
      <div className="flex items-center gap-2">
        <label htmlFor="store-parent" className="text-sm text-gray-600 whitespace-nowrap">
          {parentLabel}
        </label>
        <select
          id="store-parent"
          value={parentId}
          onChange={(e) => onParentChange?.(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[160px]"
        >
          <option value="">{parentPlaceholder}</option>
          {parentOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code} — ` : ""}
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="store-branch" className="text-sm text-gray-600 whitespace-nowrap">
          {branchLabel}
        </label>
        <select
          id="store-branch"
          value={branchId}
          onChange={(e) => onBranchChange?.(e.target.value)}
          disabled={!parentId}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[160px] disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">{branchPlaceholder}</option>
          {branchOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code} — ` : ""}
              {s.name}
              {s._isParentOption ? " (Parent)" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
