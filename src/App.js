// App.js
import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import { Toaster } from "react-hot-toast";

import LoginPages from "./components/LoginPages";
import Sidebar from "./components/Sidebar";

import POSPage from "./pages/POSPage";
import ProductPage from "./pages/ProductPage";
import InventoryPage from "./pages/InventoryPage";
import PurchasePage from "./pages/PurchasePage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import GRPage from './pages/GRPage';

import { isLoggedIn, logoutRequest, getTokenExpiration  } from "./api/auth";
import { STORAGE_KEY } from "./api/client";

import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

// ====== SUMBER KEBENARAN ROLE → PAGES ======
const DEFAULT_ALLOWED = {
  admin: ["home", "pos", "products", "inventory", "purchase", "gr", "history"],
  kasir: ["home", "pos", "history"],
};

// map page key → path
const PAGE_PATH = {
  home: "/home",
  pos: "/pos",
  products: "/products",
  inventory: "/inventory",
  purchase: "/purchase",
  history: "/history",
  gr: "/gr",
};

// Ambil role dari localStorage (sesuaikan struktur kamu)
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

// Komponen guard per-route (cek role)
function ProtectedRoute({ children, pageKey, allowedPages }) {
  if (!allowedPages.includes(pageKey)) {
    // redirect ke halaman pertama yang allowed
    const first = PAGE_PATH[allowedPages[0]] || "/pos";
    return <Navigate to={first} replace />;
  }
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth & role
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [role, setRole] = useState(() => getRoleFromStorage());

  // Daftar halaman yang boleh untuk role ini — SUMBER dari DEFAULT_ALLOWED
  const allowedPages = useMemo(
    () => DEFAULT_ALLOWED[role] || DEFAULT_ALLOWED.kasir,
    [role]
  );

  // Sinkron antar-tab saat token/role berubah
  useEffect(() => {
    const onStorage = () => {
      setLoggedIn(isLoggedIn());
      setRole(getRoleFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

    // ✅ TAMBAHAN: Periodic check token expiration (setiap 30 detik)
  useEffect(() => {
    if (!loggedIn) return;

    const interval = setInterval(() => {
      if (!isLoggedIn()) {
        console.log("Token expired - logging out");
        setLoggedIn(false);
        setRole("kasir");
      }
    }, 30000); // Check setiap 30 detik

    return () => clearInterval(interval);
  }, [loggedIn]);

  // ✅ OPTIONAL: Log token info saat dev (untuk debugging)
  // useEffect(() => {
  //   if (loggedIn && process.env.NODE_ENV === 'development') {
  //     const tokenInfo = getTokenExpiration();
  //     if (tokenInfo) {
  //       console.log('Token expires at:', tokenInfo.expiresAt);
  //       console.log('Time remaining:', tokenInfo.timeRemainingMinutes, 'minutes');
  //     }
  //   }
  // }, [loggedIn]);

  // Logout handler
  const handleLogout = async () => {
    await logoutRequest();
    setLoggedIn(false);
    setRole("kasir");
    navigate(PAGE_PATH.pos, { replace: true });
  };

  // Setelah login sukses
  if (!loggedIn) {
    return (
      <LoginPages
        onLogin={() => {
          setLoggedIn(true);
          const r = getRoleFromStorage();
          setRole(r);
          const first = (DEFAULT_ALLOWED[r] || DEFAULT_ALLOWED.kasir)[0];
          navigate(PAGE_PATH[first] || "/pos", { replace: true });
        }}
      />
    );
  }

  // Sidebar navigate
  const handleNavigate = (pageKey) => {
    if (!allowedPages.includes(pageKey)) return;
    navigate(PAGE_PATH[pageKey] || "/pos");
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        // tandai aktif berdasarkan pathname
        currentPage={
          Object.keys(PAGE_PATH).find((k) => PAGE_PATH[k] === location.pathname) ||
          "pos"
        }
        onNavigate={handleNavigate}
        userRole={role}
        allowedPages={allowedPages}
        onLogout={handleLogout}
      />

      <div className="flex-1 md:ml-24">
        <Routes>
          {/* Redirect root → /pos (atau home, terserah) */}
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
          <Route
            path={PAGE_PATH.inventory}
            element={
              <ProtectedRoute pageKey="inventory" allowedPages={allowedPages}>
                <InventoryPage />
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

          {/* 404 → balik ke /pos */}
          <Route path="*" element={<Navigate to={PAGE_PATH.pos} replace />} />
        </Routes>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}
