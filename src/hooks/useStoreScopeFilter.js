import { useCallback, useEffect, useMemo, useState } from "react";
import { canSwitchStores } from "../utils/roles";
import {
  branchStoresForParent,
  parentIdForStore,
  storeIdsUnderParent,
  storeLabel,
} from "../utils/storeScope";

const readKey = (key) => {
  if (typeof window === "undefined" || !key) return "";
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const writeKey = (key, val) => {
  if (typeof window === "undefined" || !key) return;
  try {
    window.localStorage.setItem(key, val || "");
  } catch {
    // ignore
  }
};

/**
 * Parent Store + Branch Store selection for HQ / multi-store users.
 *
 * Parent=A + Branch="Semua cabang" → scope = A + children (e.g. A,B,C).
 * Not every store in the company.
 */
export function useStoreScopeFilter({
  branchStorageKey,
  parentStorageKey,
  me,
  stores = [],
}) {
  const [parentFilterId, setParentFilterId] = useState(() =>
    readKey(parentStorageKey)
  );
  const [storeFilterId, setStoreFilterId] = useState(() =>
    readKey(branchStorageKey)
  );

  const canPickStore = useMemo(
    () => canSwitchStores(me?.role, me),
    [me]
  );

  const myStoreId = useMemo(
    () => me?.store_location_id ?? me?.store_location?.id ?? null,
    [me]
  );

  /** Single branch id, or null when viewing parent-wide / all stores. */
  const effectiveStoreId = useMemo(() => {
    if (!canPickStore) {
      return myStoreId != null ? Number(myStoreId) : null;
    }
    if (storeFilterId) return Number(storeFilterId);
    return null;
  }, [canPickStore, myStoreId, storeFilterId]);

  /**
   * null  = no restriction (Semua parent)
   * [ids] = concrete store ids (one branch, or parent + all its cabang)
   */
  const effectiveStoreIds = useMemo(() => {
    if (!canPickStore) {
      return myStoreId != null ? [Number(myStoreId)] : [];
    }
    if (storeFilterId) return [Number(storeFilterId)];
    if (parentFilterId) {
      return storeIdsUnderParent(stores, parentFilterId, me);
    }
    return null;
  }, [canPickStore, myStoreId, storeFilterId, parentFilterId, stores, me]);

  const needsStoreSelection =
    canPickStore && (!parentFilterId || !storeFilterId);

  const activeStoreLabel = useMemo(() => {
    if (!canPickStore) {
      const sid = effectiveStoreId;
      if (sid == null) return "-";
      return storeLabel(stores, sid, me?.store_location?.name ?? "-");
    }
    if (storeFilterId) {
      return storeLabel(stores, storeFilterId, me?.store_location?.name ?? "-");
    }
    if (parentFilterId) {
      return `Semua cabang · ${storeLabel(stores, parentFilterId, "Parent")}`;
    }
    return "Semua parent";
  }, [
    canPickStore,
    storeFilterId,
    parentFilterId,
    effectiveStoreId,
    stores,
    me,
  ]);

  useEffect(() => {
    if (!me || canPickStore) return;
    const sid = me?.store_location?.id ?? me?.store_location_id ?? null;
    if (sid != null) {
      setStoreFilterId(String(sid));
      setParentFilterId(parentIdForStore(stores, sid));
    }
  }, [me, canPickStore, stores]);

  useEffect(() => {
    if (!stores.length || !storeFilterId || parentFilterId) return;
    const pid = parentIdForStore(stores, storeFilterId);
    if (pid) setParentFilterId(pid);
  }, [stores, storeFilterId, parentFilterId]);

  // Clear branch if it no longer belongs under the selected parent.
  useEffect(() => {
    if (!canPickStore || !parentFilterId || !storeFilterId || !stores.length) {
      return;
    }
    const branches = branchStoresForParent(stores, parentFilterId, me);
    const ok = branches.some((b) => String(b.id) === String(storeFilterId));
    if (!ok) setStoreFilterId("");
  }, [canPickStore, parentFilterId, storeFilterId, stores, me]);

  useEffect(() => {
    if (!canPickStore) return;
    writeKey(parentStorageKey, parentFilterId);
  }, [canPickStore, parentStorageKey, parentFilterId]);

  useEffect(() => {
    if (!canPickStore) return;
    writeKey(branchStorageKey, storeFilterId);
  }, [canPickStore, branchStorageKey, storeFilterId]);

  const handleParentChange = useCallback(
    (nextParentId) => {
      setParentFilterId(nextParentId);
      const branches = branchStoresForParent(stores, nextParentId, me);
      setStoreFilterId(
        branches.length === 1 ? String(branches[0].id) : ""
      );
    },
    [stores, me]
  );

  const handleBranchChange = useCallback((nextBranchId) => {
    setStoreFilterId(nextBranchId);
  }, []);

  return {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    effectiveStoreIds,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  };
}
