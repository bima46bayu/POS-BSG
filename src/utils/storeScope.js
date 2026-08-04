import { isHqAdmin } from "./roles";

/** Stores visible to the current user (respects allowed_store_ids). */
export function filterStoresForUser(stores, me) {
  const list = Array.isArray(stores) ? stores : [];
  if (!me || isHqAdmin(me.role)) return list;
  const allowed = me.allowed_store_ids;
  if (!Array.isArray(allowed) || allowed.length === 0) return list;
  return list.filter((s) => allowed.includes(s.id));
}

/** Root / parent stores for the first dropdown. */
export function visibleParentStores(stores, me) {
  const filtered = filterStoresForUser(stores, me);
  const all = Array.isArray(stores) ? stores : [];
  const parents = new Map();

  for (const s of filtered) {
    if (!s.parent_id) {
      parents.set(s.id, s);
      continue;
    }
    const parent =
      all.find((x) => x.id === s.parent_id) ||
      filtered.find((x) => x.id === s.parent_id);
    if (parent) parents.set(parent.id, parent);
  }

  return Array.from(parents.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

/** Branch options under a selected parent (parent itself + child branches). */
export function branchStoresForParent(stores, parentId, me) {
  if (!parentId) return [];
  const filtered = filterStoresForUser(stores, me);
  const all = Array.isArray(stores) ? stores : [];
  const pid = String(parentId);
  const parent =
    filtered.find((s) => String(s.id) === pid) ||
    all.find((s) => String(s.id) === pid);
  const children = filtered
    .filter((s) => String(s.parent_id) === pid)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!parent && children.length === 0) return [];

  const options = [];
  if (parent) {
    options.push({ ...parent, _isParentOption: children.length > 0 });
  }
  return [...options, ...children];
}

/**
 * Ids in parent scope: parent A + branches B,C → [A,B,C].
 * Used when Branch Store = "Semua cabang".
 */
export function storeIdsUnderParent(stores, parentId, me) {
  return branchStoresForParent(stores, parentId, me)
    .map((s) => Number(s.id))
    .filter((id) => Number.isFinite(id));
}

/** Resolve parent id from a branch or root store id. */
export function parentIdForStore(stores, storeId) {
  if (!storeId) return "";
  const store = (stores || []).find((s) => String(s.id) === String(storeId));
  if (!store) return "";
  if (store.parent_id) return String(store.parent_id);
  return String(store.id);
}

export function storeLabel(stores, storeId, fallback = "-") {
  if (!storeId) return fallback;
  const found = (stores || []).find((s) => String(s.id) === String(storeId));
  return found?.name || fallback;
}
