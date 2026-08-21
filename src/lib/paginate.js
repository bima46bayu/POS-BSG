// src/lib/paginate.js
//
// One place that understands every list shape our backend returns.
//
// The Laravel endpoints in this project are inconsistent: some return a raw
// array, some a stock paginator with fields at the root, some a
// { data, meta } envelope, and a couple use { pagination: { page,
// total_pages } }. Every api module used to re-derive this by hand, which is
// why page counts disagreed between screens.
//
// Always returns the same shape:
//   { items, meta: { current_page, per_page, last_page, total }, links }

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * @param {any} raw Response body.
 * @param {{ page?: number, per_page?: number }} [params] Requested params,
 *   used only to fill gaps when the backend omits pagination metadata.
 */
export function unwrapPaginated(raw, params = {}) {
  const reqPer = num(params.per_page, 10) || 10;
  const reqPage = num(params.page, 1) || 1;

  // Locate the row array and the metadata block, wherever they live.
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  // `pagination` uses page/total_pages instead of current_page/last_page.
  const meta = raw?.meta ?? raw?.pagination ?? (Array.isArray(raw) ? null : raw);

  const total = num(meta?.total, items.length);
  const perPage = num(meta?.per_page ?? meta?.perPage, 0) || reqPer;
  const currentPage =
    num(meta?.current_page ?? meta?.currentPage ?? meta?.page, 0) || reqPage;

  // Derive last_page when absent rather than defaulting to 1 -- defaulting
  // hides later pages and makes pagination controls disappear.
  const reportedLast = meta?.last_page ?? meta?.lastPage ?? meta?.total_pages;
  const lastPage =
    num(reportedLast, 0) || Math.max(1, Math.ceil(total / Math.max(1, perPage)));

  return {
    items,
    meta: {
      current_page: currentPage,
      per_page: perPage,
      last_page: lastPage,
      total,
    },
    links: {
      next: raw?.next_page_url ?? raw?.links?.next ?? null,
      prev: raw?.prev_page_url ?? raw?.links?.prev ?? null,
    },
  };
}

/** Single object out of a `{ data: {...} }` envelope (or the object itself). */
export function unwrapItem(raw) {
  if (raw == null) return null;
  return raw?.data ?? raw;
}

/** Plain array out of any list response, when pagination is irrelevant. */
export function unwrapArray(raw) {
  return unwrapPaginated(raw).items;
}
