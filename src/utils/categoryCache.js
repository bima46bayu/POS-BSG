export const CATEGORIES_CACHE_KEY = "POS_CATEGORIES_CACHE_V1";
export const CATEGORIES_DIRTY_KEY = "POS_CATS_DIRTY";
export const CATEGORIES_DIRTY_EVENT = "pos-categories-cache-dirty";

export function scopedCategoriesCacheKey(storeLocationId) {
  const suffix = storeLocationId != null ? String(storeLocationId) : "all";
  return `${CATEGORIES_CACHE_KEY}_${suffix}`;
}

export function isCategoriesCacheDirty() {
  try {
    return localStorage.getItem(CATEGORIES_DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearCategoriesCacheDirty() {
  try {
    localStorage.removeItem(CATEGORIES_DIRTY_KEY);
  } catch {
    // ignore
  }
}

/** Call after category/subcategory create, update, or delete. */
export function markCategoriesCacheDirty(storeLocationId = null) {
  try {
    localStorage.setItem(CATEGORIES_DIRTY_KEY, "1");
    if (storeLocationId != null) {
      localStorage.removeItem(scopedCategoriesCacheKey(storeLocationId));
    }
  } catch {
    // ignore
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CATEGORIES_DIRTY_EVENT, {
        detail: { storeLocationId },
      })
    );
  }
}
