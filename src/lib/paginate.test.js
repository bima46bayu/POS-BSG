import { unwrapPaginated, unwrapItem, unwrapArray } from "./paginate";

test("laravel paginator with root fields", () => {
  const r = unwrapPaginated({
    current_page: 2,
    data: [{ id: 1 }],
    per_page: 10,
    last_page: 5,
    total: 42,
    next_page_url: "/x?page=3",
  });
  expect(r.items).toEqual([{ id: 1 }]);
  expect(r.meta).toEqual({
    current_page: 2,
    per_page: 10,
    last_page: 5,
    total: 42,
  });
  expect(r.links.next).toBe("/x?page=3");
});

test("data + meta envelope", () => {
  const r = unwrapPaginated({
    data: [{ id: 1 }, { id: 2 }],
    meta: { current_page: 1, per_page: 2, last_page: 3, total: 6 },
  });
  expect(r.items).toHaveLength(2);
  expect(r.meta.last_page).toBe(3);
});

test("plain array falls back to requested params", () => {
  const r = unwrapPaginated([{ id: 1 }, { id: 2 }], { per_page: 25, page: 1 });
  expect(r.items).toHaveLength(2);
  expect(r.meta.total).toBe(2);
  expect(r.meta.per_page).toBe(25);
  expect(r.meta.last_page).toBe(1);
});

test("pagination block uses page/total_pages aliases", () => {
  const r = unwrapPaginated({
    data: [{ id: 1 }],
    pagination: { page: 3, total_pages: 7, total: 70, per_page: 10 },
  });
  expect(r.meta.current_page).toBe(3);
  expect(r.meta.last_page).toBe(7);
});

test("derives last_page when backend omits it", () => {
  // Regression: several modules defaulted last_page to 1 here, which hid
  // every page after the first.
  const r = unwrapPaginated({ data: [{ id: 1 }], per_page: 10, total: 95 });
  expect(r.meta.last_page).toBe(10);
});

test("items key is accepted as well as data", () => {
  const r = unwrapPaginated({ items: [{ id: 9 }], meta: { total: 1 } });
  expect(r.items).toEqual([{ id: 9 }]);
});

test("empty and malformed payloads stay safe", () => {
  for (const bad of [null, undefined, {}, 0, "nope"]) {
    const r = unwrapPaginated(bad);
    expect(r.items).toEqual([]);
    expect(r.meta.last_page).toBe(1);
    expect(r.meta.current_page).toBe(1);
  }
});

test("unwrapItem and unwrapArray", () => {
  expect(unwrapItem({ data: { id: 3 } })).toEqual({ id: 3 });
  expect(unwrapItem({ id: 4 })).toEqual({ id: 4 });
  expect(unwrapItem(null)).toBeNull();
  expect(unwrapArray({ data: [1, 2] })).toEqual([1, 2]);
  expect(unwrapArray(null)).toEqual([]);
});
