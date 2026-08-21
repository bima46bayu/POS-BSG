// Odoo-style module launcher (replaces sidebar-first navigation from Home)
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Archive,
  ShoppingCart,
  Clock,
  FolderTree,
  Layers,
  LogOut,
  ChevronLeft,
  Scale,
  Trash2,
  PackageCheck,
  FileText,
  User,
  Users,
  Folder,
  GitBranch,
  ChefHat,
  SlidersHorizontal,
  BadgeDollarSign,
  BadgePercent,
  Truck,
  MapPin,
  KeyRound,
  Gift,
} from "lucide-react";

const BG =
  "linear-gradient(165deg, #F5FAF7 0%, #E3F3EA 45%, #EDF7F1 100%)";
const TILE = 88;

function AppTile({ label, icon: Icon, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[104px] flex-col items-center gap-2 rounded-xl p-2 text-center transition hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6DAB8C]/40"
    >
      <span
        className="flex items-center justify-center rounded-2xl text-white shadow-md transition group-hover:scale-[1.04] group-active:scale-[0.98]"
        style={{
          width: TILE,
          height: TILE,
          background: color,
          boxShadow: "0 8px 20px rgba(74, 122, 98, 0.18)",
        }}
      >
        <Icon size={40} strokeWidth={1.6} />
      </span>
      <span className="text-[13px] font-medium leading-tight text-[#3D4F48]">
        {label}
      </span>
    </button>
  );
}

const ROOT_APPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    color: "#714B67",
    path: "/dashboard",
    need: "home",
  },
  {
    id: "pos",
    label: "Point of Sale",
    icon: CreditCard,
    color: "#017E84",
    path: "/pos",
    need: "pos",
  },
  {
    id: "products",
    label: "Catalog",
    icon: Package,
    color: "#5D8DA8",
    path: "/products",
    need: "products",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Archive,
    color: "#C3BE6D",
    folder: "inventory",
    need: "inventory",
  },
  {
    id: "purchase",
    label: "Purchase",
    icon: ShoppingCart,
    color: "#F06E26",
    folder: "purchase",
    needAny: ["purchase", "gr"],
  },
  {
    id: "history",
    label: "History",
    icon: Clock,
    color: "#875A7B",
    path: "/history",
    need: "history",
  },
  {
    id: "stock-review",
    label: "Stock Review",
    icon: Scale,
    color: "#B45F06",
    path: "/stock-review",
    need: "history",
  },
  {
    id: "member-store",
    label: "Member Store",
    icon: Gift,
    color: "#674EA7",
    path: "/member-store",
    need: "pos",
  },
  {
    id: "master",
    label: "Master",
    icon: FolderTree,
    color: "#00A09D",
    folder: "master",
    need: "master",
  },
  {
    id: "setup",
    label: "Setup",
    icon: Layers,
    color: "#5B6ABF",
    folder: "setup",
    need: "master",
  },
];

const FOLDERS = {
  inventory: {
    title: "Inventory",
    apps: [
      {
        id: "inv-products",
        label: "Stock",
        icon: Archive,
        color: "#C3BE6D",
        path: "/inventory/products",
        need: "inventory",
      },
      {
        id: "inv-recon",
        label: "Reconciliation",
        icon: Scale,
        color: "#6AA84F",
        path: "/inventory/reconciliation",
        need: "inventory",
      },
      {
        id: "inv-waste",
        label: "Waste / Write-off",
        icon: Trash2,
        color: "#CC0000",
        path: "/inventory/write-off",
        need: "inventory",
      },
    ],
  },
  purchase: {
    title: "Purchase",
    apps: [
      {
        id: "pur-po",
        label: "Purchase",
        icon: ShoppingCart,
        color: "#F06E26",
        path: "/purchase",
        need: "purchase",
      },
      {
        id: "pur-gr",
        label: "Goods Receipt",
        icon: PackageCheck,
        color: "#E69138",
        path: "/gr",
        need: "gr",
      },
      {
        id: "pur-pr",
        label: "Payment Requests",
        icon: FileText,
        color: "#3D85C6",
        path: "/payment-requests",
        need: "home",
      },
    ],
  },
  master: {
    title: "Master",
    apps: [
      {
        id: "m-user",
        label: "User",
        icon: User,
        color: "#3C7A89",
        path: "/master/user",
        need: "master",
      },
      {
        id: "m-member",
        label: "Member & Customer",
        icon: Users,
        color: "#674EA7",
        path: "/master/member",
        need: "master",
      },
      {
        id: "m-supplier",
        label: "Supplier",
        icon: Truck,
        color: "#B45F06",
        path: "/master/supplier",
        need: "master",
      },
      {
        id: "m-store",
        label: "Store Location",
        icon: MapPin,
        color: "#38761D",
        path: "/master/store-location",
        need: "master",
      },
      {
        id: "m-void",
        label: "Kode Void",
        icon: KeyRound,
        color: "#990000",
        path: "/master/void-security-code",
        need: "master",
      },
    ],
  },
  setup: {
    title: "Setup",
    apps: [
      {
        id: "s-cat",
        label: "Category",
        icon: Folder,
        color: "#45818E",
        path: "/master/category",
        need: "master",
      },
      {
        id: "s-sub",
        label: "Sub-Category",
        icon: GitBranch,
        color: "#76A5AF",
        path: "/master/sub-category",
        need: "master",
      },
      {
        id: "s-recipe",
        label: "Product Recipe",
        icon: ChefHat,
        color: "#E69138",
        path: "/master/recipe",
        need: "master",
      },
      {
        id: "s-opt",
        label: "Product Options",
        icon: SlidersHorizontal,
        color: "#8E7CC3",
        path: "/master/product-option",
        need: "master",
      },
      {
        id: "s-charge",
        label: "Additional Charge",
        icon: BadgeDollarSign,
        color: "#6AA84F",
        path: "/master/additional-charge",
        need: "master",
      },
      {
        id: "s-disc",
        label: "Discount",
        icon: BadgePercent,
        color: "#CC0000",
        path: "/master/discount",
        need: "master",
      },
      {
        id: "s-rewards",
        label: "Point Rewards",
        icon: Gift,
        color: "#674EA7",
        path: "/master/loyalty-rewards",
        need: "master",
      },
    ],
  },
};

function isAllowed(app, allowedSet) {
  if (app.needAny) return app.needAny.some((k) => allowedSet.has(k));
  if (app.need) return allowedSet.has(app.need);
  return true;
}

export default function AppsHomePage({
  allowedPages = [],
  onLogout,
  logoSrc = "/images/LogoBSG.png",
}) {
  const navigate = useNavigate();
  const [folder, setFolder] = useState(null);
  const allowedSet = useMemo(() => new Set(allowedPages), [allowedPages]);

  const rootApps = useMemo(
    () => ROOT_APPS.filter((a) => isAllowed(a, allowedSet)),
    [allowedSet]
  );

  const folderDef = folder ? FOLDERS[folder] : null;
  const folderApps = useMemo(() => {
    if (!folderDef) return [];
    return folderDef.apps.filter((a) => isAllowed(a, allowedSet));
  }, [folderDef, allowedSet]);

  const openApp = (app) => {
    if (app.folder) {
      setFolder(app.folder);
      return;
    }
    if (app.path) navigate(app.path);
  };

  const apps = folder ? folderApps : rootApps;

  return (
    <div
      className="relative flex min-h-screen flex-col text-[#3D4F48]"
      style={{ background: BG }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          {folder ? (
            <button
              type="button"
              onClick={() => setFolder(null)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#558F72] hover:bg-white/70 hover:text-[#3D4F48]"
            >
              <ChevronLeft size={18} />
              Apps
            </button>
          ) : (
            <img
              src={logoSrc.startsWith("/") ? logoSrc : `/${logoSrc}`}
              alt="Logo"
              className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shadow-sm"
            />
          )}
          {folderDef && (
            <h1 className="text-lg font-semibold tracking-tight text-[#3D4F48]">
              {folderDef.title}
            </h1>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7A9188] hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      {/* App grid */}
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-6">
        <div className="flex max-w-4xl flex-wrap items-start justify-center gap-x-4 gap-y-8 md:gap-x-6">
          {apps.map((app) => (
            <AppTile
              key={app.id}
              label={app.label}
              icon={app.icon}
              color={app.color}
              onClick={() => openApp(app)}
            />
          ))}
          {apps.length === 0 && (
            <p className="text-sm text-[#7A9188]">No apps available for your role.</p>
          )}
        </div>
      </main>
    </div>
  );
}
