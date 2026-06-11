const ROLES = {
  ADMIN: "admin",
  REGIONAL_MANAGER: "regional_manager",
  STORE_ADMIN: "store_admin",
  KASIR: "kasir",
};

const toLower = (v) => String(v || "").trim().toLowerCase();

export function isHqAdmin(role) {
  return toLower(role) === ROLES.ADMIN;
}

export function isRegionalManager(role) {
  return toLower(role) === ROLES.REGIONAL_MANAGER;
}

export function isStoreAdmin(role) {
  return toLower(role) === ROLES.STORE_ADMIN;
}

export function isKasir(role) {
  return toLower(role) === ROLES.KASIR;
}

/** Admin, Regional Manager, or Store Admin — ops + master access */
export function hasManagementAccess(role) {
  const r = toLower(role);
  return (
    r === ROLES.ADMIN ||
    r === ROLES.REGIONAL_MANAGER ||
    r === ROLES.STORE_ADMIN
  );
}

/** Can pick between multiple stores in the UI */
export function canSwitchStores(role, me) {
  if (isHqAdmin(role)) return true;
  if (me?.can_switch_store) return true;
  const allowed = me?.allowed_store_ids;
  return Array.isArray(allowed) && allowed.length > 1;
}

export function roleLabel(role) {
  const r = toLower(role);
  switch (r) {
    case ROLES.ADMIN:
      return "Admin (HQ)";
    case ROLES.REGIONAL_MANAGER:
      return "Regional Manager";
    case ROLES.STORE_ADMIN:
      return "Store Admin";
    case ROLES.KASIR:
      return "Kasir";
    default:
      return role || "Kasir";
  }
}

export const DEFAULT_ALLOWED = {
  [ROLES.ADMIN]: [
    "home",
    "pos",
    "products",
    "inventory",
    "purchase",
    "gr",
    "history",
    "master",
  ],
  [ROLES.REGIONAL_MANAGER]: [
    "home",
    "pos",
    "products",
    "inventory",
    "purchase",
    "gr",
    "history",
    "master",
  ],
  [ROLES.STORE_ADMIN]: [
    "home",
    "pos",
    "products",
    "inventory",
    "purchase",
    "gr",
    "history",
    "master",
  ],
  [ROLES.KASIR]: ["home", "pos", "history"],
};

export function getAllowedPages(role) {
  const r = toLower(role);
  return DEFAULT_ALLOWED[r] || DEFAULT_ALLOWED[ROLES.KASIR];
}

export const DEFAULT_ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "Admin (HQ)" },
  { value: ROLES.REGIONAL_MANAGER, label: "Regional Manager" },
  { value: ROLES.STORE_ADMIN, label: "Store Admin" },
  { value: ROLES.KASIR, label: "Kasir" },
];

/** Role choices for Add/Edit user modals based on actor + API options. */
export function roleOptionsForActor(me, apiOptions = []) {
  const normalized = (Array.isArray(apiOptions) ? apiOptions : [])
    .map((o) => ({
      value: toLower(typeof o === "string" ? o : o?.value),
      label: typeof o === "string" ? roleLabel(o) : (o?.label || roleLabel(o?.value)),
    }))
    .filter((o) => o.value);

  if (normalized.length > 0) {
    return normalized;
  }

  const actorRole = toLower(me?.role);
  if (actorRole === ROLES.ADMIN) return DEFAULT_ROLE_OPTIONS;
  if (actorRole === ROLES.REGIONAL_MANAGER) {
    return DEFAULT_ROLE_OPTIONS.filter(
      (o) => o.value === ROLES.STORE_ADMIN || o.value === ROLES.KASIR
    );
  }
  if (actorRole === ROLES.STORE_ADMIN) {
    return DEFAULT_ROLE_OPTIONS.filter((o) => o.value === ROLES.KASIR);
  }
  return [];
}

export { ROLES };
