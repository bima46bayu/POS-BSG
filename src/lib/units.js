/** Canonical unit key, e.g. kilogram → kg. */
export function normalizeUnitKey(name) {
  const key = String(name || "").toLowerCase().trim();
  const map = {
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    g: "g",
    gr: "g",
    gram: "g",
    grams: "g",
    l: "l",
    liter: "l",
    litre: "l",
    ltr: "l",
    ml: "ml",
    milliliter: "ml",
    millilitre: "ml",
  };
  return map[key] || key;
}

export function unitFamily(name) {
  const key = normalizeUnitKey(name);
  if (key === "kg" || key === "g") return "mass";
  if (key === "l" || key === "ml") return "volume";
  return "other";
}

export function compatibleUnits(allUnits, stockUnitName) {
  const list = Array.isArray(allUnits) ? allUnits : [];
  if (!stockUnitName) return list;
  const family = unitFamily(stockUnitName);
  if (family === "mass") {
    return list.filter((u) => unitFamily(u.name) === "mass");
  }
  if (family === "volume") {
    return list.filter((u) => unitFamily(u.name) === "volume");
  }
  const stockKey = normalizeUnitKey(stockUnitName);
  return list.filter((u) => normalizeUnitKey(u.name) === stockKey);
}

function toBaseAmount(qty, unitKey) {
  if (unitKey === "g" || unitKey === "ml") return qty / 1000;
  return qty;
}

function fromBaseAmount(baseQty, unitKey) {
  if (unitKey === "g" || unitKey === "ml") return baseQty * 1000;
  return baseQty;
}

/** Convert qty between compatible units (Kg↔g, L↔Ml). Same unit / other → unchanged. */
export function convertQty(qty, fromName, toName) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return n;
  const fromKey = normalizeUnitKey(fromName);
  const toKey = normalizeUnitKey(toName);
  if (!fromKey || !toKey || fromKey === toKey) return n;
  const fromFam = unitFamily(fromName);
  const toFam = unitFamily(toName);
  if (fromFam !== toFam || fromFam === "other") return n;
  return fromBaseAmount(toBaseAmount(n, fromKey), toKey);
}

export function matchUnitId(units, stockUnitName) {
  const list = Array.isArray(units) ? units : [];
  const key = normalizeUnitKey(stockUnitName);
  const found = list.find((u) => normalizeUnitKey(u.name) === key);
  return found ? String(found.id) : list[0] ? String(list[0].id) : "";
}

/** Display label for a unit name (Ml → ml, liter → L). */
export function formatUnitLabel(name) {
  const key = normalizeUnitKey(name);
  if (key === "l") return "L";
  if (key === "ml") return "ml";
  if (key === "kg") return "kg";
  if (key === "g") return "g";
  const raw = String(name || "").trim();
  return raw || key;
}

export function unitNameById(units, id) {
  const u = (Array.isArray(units) ? units : []).find(
    (x) => String(x.id) === String(id)
  );
  return u?.name || "";
}

export function formatQtyInput(n) {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "";
  const s = Number(n).toFixed(6).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}
