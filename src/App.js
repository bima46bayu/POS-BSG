// App.js
import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import { Toaster } from "react-hot-toast";

import LoginPages from "./components/LoginPages";
import Sidebar from "./components/Sidebar";

import POSPage from "./pages/POSPage";
import ProductPage from "./pages/ProductPage";
import InventoryProductsPage from "./pages/InventoryPage";
import InventoryProductSummaryPage from "./pages/InventorySummaryPage";
import PurchasePage from "./pages/PurchasePage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import GRPage from "./pages/GRPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage";

// ⬅️ NEW (tanpa huruf s)
import MasterUserPage from "./pages/master/MasterUserPage";
import MasterCategoryPage from "./pages/master/MasterCategoryPage";
import MasterSubCategoryPage from "./pages/master/MasterSubCategoryPage";
import MasterSupplierPage from "./pages/master/MasterSupplierPage";
import MasterStorePage from "./pages/master/MasterStorePage";

import { isLoggedIn, logoutRequest } from "./api/auth";
import { STORAGE_KEY, installUnauthorizedRedirect, onUnauthorized } from "./api/client";

import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, err) => {
        if (err?.name === "CanceledError") return false;
        const status = err?.response?.status;
        if (status === 401) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const DEFAULT_ALLOWED = {
  admin: ["home", "pos", "products", "inventory", "purchase", "gr", "history", "master"], // ⬅️ NEW
  kasir: ["home", "pos", "history"],
};

const PAGE_PATH = {
  home: "/home",
  pos: "/pos",
  products: "/products",
  inventory: "/inventory/products",
  purchase: "/purchase",
  history: "/history",
  gr: "/gr",
  // ⬅️ NEW: master parent (pakai default ke users)
  master: "/master/users",
};

const KNOWN_PATHS = new Set([
  "/",
  "/unauthorized",
  "/home",
  "/pos",
  "/products",
  "/inventory/products",
  "/purchase",
  "/history",
  "/gr",
  // ⬅️ NEW: master known base; childnya ditangani via startsWith
  "/master",
]);

function getRoleFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "kasir";
    const parsed = JSON.parse(raw);
    return parsed?.user?.role || parsed?.role || "kasir";
  } catch {
    return "kasir";
  }
}

function ProtectedRoute({ children, pageKey, allowedPages }) {
  if (!allowedPages.includes(pageKey)) {
    const first = PAGE_PATH[allowedPages[0]] || "/home";
    return <Navigate to={first} replace />;
  }
  return children;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [role, setRole] = useState(() => getRoleFromStorage());

  const allowedPages = useMemo(
    () => DEFAULT_ALLOWED[role] || DEFAULT_ALLOWED.kasir,
    [role]
  );

  // Sinkron antar-tab
  useEffect(() => {
    const onStorage = () => {
      setLoggedIn(isLoggedIn());
      setRole(getRoleFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Pasang listener 401 hanya kalau SUDAH login
  useEffect(() => {
    if (!loggedIn) return;
    const off1 = installUnauthorizedRedirect({
      queryClient,
      navigate,
      loginPath: "/unauthorized",
    });
    const off2 = onUnauthorized(() => {
      localStorage.removeItem(STORAGE_KEY);
      setLoggedIn(false);
      setRole("kasir");
    });
    return () => { off1(); off2(); };
  }, [loggedIn, navigate]);

  // Normalisasi path setelah login
  useEffect(() => {
    if (!loggedIn) return;
    const p = location.pathname;
    const isInventoryDetail = p.startsWith("/inventory/products/");
    const isMasterChild = p.startsWith("/master/"); // ⬅️ NEW
    if (!KNOWN_PATHS.has(p) && !isInventoryDetail && !isMasterChild) {
      const firstKey = (DEFAULT_ALLOWED[role] || DEFAULT_ALLOWED.kasir)[0] || "pos";
      const target = PAGE_PATH[firstKey] || "/pos";
      navigate(target, { replace: true });
    }
  }, [loggedIn, location.pathname, role, navigate]);

  // Halaman login
  if (!loggedIn) {
    return (
      <LoginPages
        onLogin={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();

          setLoggedIn(true);
          const r = getRoleFromStorage();
          setRole(r);

          const first = (DEFAULT_ALLOWED[r] || DEFAULT_ALLOWED.kasir)[0] || "pos";
          const target = PAGE_PATH[first] || "/pos";
          navigate(target, { replace: true });
        }}
      />
    );
  }

  // Sidebar navigate
  const handleNavigate = (pageKey) => {
    if (!allowedPages.includes(pageKey)) return;
    navigate(PAGE_PATH[pageKey] || "/pos");
  };

  // Key aktif sidebar
  const getActivePageKey = () => {
    const p = location.pathname;
    if (p.startsWith("/inventory")) return "inventory";
    if (p.startsWith("/master")) return "master"; // ⬅️ NEW
    for (const [key, path] of Object.entries(PAGE_PATH)) {
      if (p === path) return key;
    }
    if (p === "/unauthorized") return null;
    return null; // 404/unknown
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentPage={getActivePageKey() || undefined}
        onNavigate={handleNavigate}
        userRole={role}
        allowedPages={allowedPages}
        onLogout={async () => {
          await logoutRequest();
          queryClient.clear();
          setLoggedIn(false);
          setRole("kasir");
          navigate("/", { replace: true });
        }}
      />

      <div className="flex-1 md:ml-24">
        <Routes>
          {/* Root → POS */}
          <Route path="/" element={<Navigate to={PAGE_PATH.pos} replace />} />

          <Route
            path={PAGE_PATH.home}
            element={
              <ProtectedRoute pageKey="home" allowedPages={allowedPages}>
                <HomePage />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.pos}
            element={
              <ProtectedRoute pageKey="pos" allowedPages={allowedPages}>
                <POSPage />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.products}
            element={
              <ProtectedRoute pageKey="products" allowedPages={allowedPages}>
                <ProductPage />
              </ProtectedRoute>
            }
          />

          {/* INVENTORY */}
          <Route
            path="/inventory/products"
            element={
              <ProtectedRoute pageKey="inventory" allowedPages={allowedPages}>
                <InventoryProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/products/:id"
            element={
              <ProtectedRoute pageKey="inventory" allowedPages={allowedPages}>
                <InventoryProductSummaryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.purchase}
            element={
              <ProtectedRoute pageKey="purchase" allowedPages={allowedPages}>
                <PurchasePage />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.gr}
            element={
              <ProtectedRoute pageKey="gr" allowedPages={allowedPages}>
                <GRPage />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.history}
            element={
              <ProtectedRoute pageKey="history" allowedPages={allowedPages}>
                <HistoryPage />
              </ProtectedRoute>
            }
          />

          {/* ===== MASTER (admin only) ===== */}
          <Route
            path="/master/user"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterUserPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/category"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterCategoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/sub-category"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterSubCategoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/supplier"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterSupplierPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/store-location"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterStorePage />
              </ProtectedRoute>
            }
          />
          {/* 401 & 404 */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
