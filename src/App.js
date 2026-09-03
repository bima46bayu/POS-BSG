import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import { Toaster } from "react-hot-toast";

import LoginPages from "./components/LoginPages";
import AppsTopBar from "./components/AppsTopBar";

import POSPage from "./pages/POSPage";
import ProductPage from "./pages/ProductPage";
import InventoryProductsPage from "./pages/InventoryPage";
import InventoryProductSummaryPage from "./pages/InventorySummaryPage";
import PurchasePage from "./pages/PurchasePage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import AppsHomePage from "./pages/AppsHomePage";
import GRPage from "./pages/GRPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage";
import StockReconciliationPage from "./pages/StockReconciliationPage";
import StockWriteOffPage from "./pages/StockWriteOffPage";
import StockReviewPage from "./pages/StockReviewPage";
import MemberStorePage from "./pages/MemberStorePage";

// Payment Request
import PaymentRequestPage from "./pages/payment-request/PaymentRequestPage";
import PaymentRequestDetailPage from "./pages/payment-request/PaymentRequestDetailPage";
import PaymentRequestBankAccountPage from "./pages/payment-request/PaymentRequestBankAccountPage";
import PaymentRequestCoaPage from "./pages/payment-request/PaymentRequestCoaPage";
import PaymentRequestPayeePage from "./pages/payment-request/PaymentRequestPayeePage";
import PaymentRequestSignatoriesPage from "./pages/payment-request/PaymentRequestSignatoriesPage";

/* ===== MASTER PAGES ===== */
import MasterUserPage from "./pages/master/MasterUserPage";
import MasterCategoryPage from "./pages/master/MasterCategoryPage";
import MasterSubCategoryPage from "./pages/master/MasterSubCategoryPage";
import MasterSupplierPage from "./pages/master/MasterSupplierPage";
import MasterStoreLocationPage from "./pages/master/MasterStoreLocationPage";
import MasterRecipePage from "./pages/master/MasterRecipePage";
import MasterDiscountPage from "./pages/master/MasterDiscountPage";
import AdditionalChargePage from "./pages/master/AdditionalChargePage";
import MasterProductOptionPage from "./pages/master/MasterProductOptionPage";
import MasterMemberPage from "./pages/master/MasterMemberPage";
import MasterLoyaltyRewardPage from "./pages/master/MasterLoyaltyRewardPage";
import VoidSecurityCodePage from "./pages/master/VoidSecurityCodePage";
import ActivityLogPage from "./pages/master/ActivityLogPage";

/* ===== AUTH / API ===== */
import { isLoggedIn, logoutRequest } from "./api/auth";
import { STORAGE_KEY, installUnauthorizedRedirect } from "./api/client";

import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { getAllowedPages, isHqAdmin } from "./utils/roles";

/* ===== REACT QUERY =====
 * Shared instance from ./queryClient. index.js already wraps the tree in a
 * QueryClientProvider, so App must not create a second client. */
import { queryClient } from "./queryClient";

const PAGE_PATH = {
  home: "/home",
  dashboard: "/dashboard",
  pos: "/pos",
  products: "/products",
  inventory: "/inventory/products",
  purchase: "/purchase",
  gr: "/gr",
  history: "/history",

  // 🔥 MASTER ROOT
  master: "/master/user",
};

/* ===== HELPERS ===== */
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
    const first = PAGE_PATH[allowedPages[0] || "pos"] || "/pos";
    return <Navigate to={first} replace />;
  }
  return children;
}

/* ===== APP SHELL ===== */
function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [role, setRole] = useState(() => getRoleFromStorage());

  const allowedPages = useMemo(
    () => getAllowedPages(role),
    [role]
  );

  /* sync auth antar tab */
  useEffect(() => {
    const onStorage = () => {
      setLoggedIn(isLoggedIn());
      setRole(getRoleFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* unauthorized handler
   * Single strategy: cancel + clear the query cache, then show the "Sesi
   * Berakhir" page. We deliberately do NOT flip loggedIn to false here -- that
   * would unmount the router subtree and render the login screen instead, so
   * the /unauthorized page would never be seen. UnauthorizedPage itself is what
   * returns the user to login. */
  useEffect(() => {
    if (!loggedIn) return;
    return installUnauthorizedRedirect({
      queryClient,
      navigate,
      loginPath: "/unauthorized",
    });
  }, [loggedIn, navigate]);

  /* redirect /master → default master page */
  useEffect(() => {
    if (!loggedIn) return;
    if (location.pathname === "/master") {
      navigate(PAGE_PATH.master, { replace: true });
    }
  }, [loggedIn, location.pathname, navigate]);

  /* ===== LOGIN ===== */
  if (!loggedIn) {
    return (
      <LoginPages
        onLogin={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();

          setLoggedIn(true);
          const r = getRoleFromStorage();
          setRole(r);

          navigate(PAGE_PATH.home, { replace: true });
        }}
      />
    );
  }

  const handleLogout = async () => {
    await logoutRequest();
    queryClient.clear();
    setLoggedIn(false);
    setRole("kasir");
    navigate("/", { replace: true });
  };

  const isAppsHome = location.pathname === PAGE_PATH.home;

  const moduleTitle = (() => {
    const p = location.pathname || "";
    if (p === PAGE_PATH.dashboard) return "Dashboard";
    if (p === PAGE_PATH.pos) return "Point of Sale";
    if (p === PAGE_PATH.products) return "Catalog";
    if (p.startsWith("/inventory/write-off")) return "Waste / Write-off";
    if (p.startsWith("/inventory/reconciliation")) return "Reconciliation";
    if (p.startsWith("/inventory")) return "Inventory";
    if (p === PAGE_PATH.purchase) return "Purchase";
    if (p === PAGE_PATH.gr) return "Goods Receipt";
    if (p === PAGE_PATH.history) return "History";
    if (p.startsWith("/stock-review")) return "Stock Review";
    if (p.startsWith("/member-store")) return "Member Store";
    if (p.startsWith("/payment-requests")) return "Payment Requests";
    if (p.startsWith("/master/user")) return "User";
    if (p.startsWith("/master/member")) return "Member & Customer";
    if (p.startsWith("/master/category")) return "Category";
    if (p.startsWith("/master/sub-category")) return "Sub-Category";
    if (p.startsWith("/master/recipe")) return "Product Recipe";
    if (p.startsWith("/master/product-option")) return "Product Options";
    if (p.startsWith("/master/additional-charge")) return "Additional Charge";
    if (p.startsWith("/master/discount")) return "Discount";
    if (p.startsWith("/master/loyalty-rewards")) return "Point Rewards";
    if (p.startsWith("/master/supplier")) return "Supplier";
    if (p.startsWith("/master/store-location")) return "Store Location";
    if (p.startsWith("/master/void-security-code")) return "Kode Void";
    if (p.startsWith("/master/otp-log")) return "Activity Log";
    if (p.startsWith("/master/activity-log")) return "Activity Log";
    if (p.startsWith("/master")) return "Master";
    return null;
  })();

  return (
    <div className="flex min-h-screen flex-col">
      {!isAppsHome && (
        <AppsTopBar onLogout={handleLogout} title={moduleTitle} />
      )}

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to={PAGE_PATH.home} replace />} />

          {/* ===== PAYMENT REQUEST ===== */}
          <Route
            path="/payment-requests"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payment-requests/detail/:id"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ===== MASTER PAYMENT REQUEST (ADMIN ONLY) ===== */}

          <Route
            path="/payment-requests/bank-accounts"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestBankAccountPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payment-requests/coas"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestCoaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payment-requests/payees"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestPayeePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payment-requests/signatories"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <PaymentRequestSignatoriesPage />
              </ProtectedRoute>
            }
          />

          {/* ===== CORE ===== */}
          <Route
            path={PAGE_PATH.home}
            element={
              <ProtectedRoute pageKey="home" allowedPages={allowedPages}>
                <AppsHomePage
                  allowedPages={allowedPages}
                  role={role}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          />

          <Route
            path={PAGE_PATH.dashboard}
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

          {/* ===== INVENTORY ===== */}
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

          {/* ===== PURCHASE & GR ===== */}
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

          <Route
            path="/stock-review"
            element={
              <ProtectedRoute pageKey="history" allowedPages={allowedPages}>
                <StockReviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/member-store"
            element={
              <ProtectedRoute pageKey="pos" allowedPages={allowedPages}>
                <MemberStorePage />
              </ProtectedRoute>
            }
          />

          {/* ===== MASTER (ADMIN ONLY) ===== */}
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
            path="/master/discount"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterDiscountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/loyalty-rewards"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterLoyaltyRewardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/recipe"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterRecipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/additional-charge"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <AdditionalChargePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/product-option"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterProductOptionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/member"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <MasterMemberPage />
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
                <MasterStoreLocationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/void-security-code"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <VoidSecurityCodePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/activity-log"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                {isHqAdmin(role) ? <ActivityLogPage /> : <Navigate to="/home" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/otp-log"
            element={<Navigate to="/master/activity-log" replace />}
          />

          {/* ===== RECONCILIATION ===== */}
          <Route
            path="/inventory/reconciliation"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <StockReconciliationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/reconciliation/:id"
            element={
              <ProtectedRoute pageKey="master" allowedPages={allowedPages}>
                <StockReconciliationPage />
              </ProtectedRoute>
            }
          />

          {/* ===== WASTE / WRITE-OFF ===== */}
          <Route
            path="/inventory/write-off"
            element={
              <ProtectedRoute pageKey="inventory" allowedPages={allowedPages}>
                <StockWriteOffPage />
              </ProtectedRoute>
            }
          />

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
