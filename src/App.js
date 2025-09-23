// App.js
import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { Toaster } from 'react-hot-toast';

import LoginPages from './components/LoginPages';
import Sidebar from './components/Sidebar';

import POSPage from './pages/POSPage';
import ProductPage from './pages/ProductPage';
import InventoryPage from './pages/InventoryPage';
import PurchasePage from './pages/PurchasePage';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';

import { isLoggedIn, logoutRequest } from './api/auth';
import { STORAGE_KEY } from './api/client';

// ====== SATU-SATUNYA SUMBER KEBENARAN ROLE → PAGES ======
const DEFAULT_ALLOWED = {
  admin: ['home', 'pos', 'products', 'inventory', 'purchase', 'history'],
  kasir: ['home', 'pos', 'history'],
};

// Ambil role dari localStorage (sesuaikan dengan struktur datamu)
function getRoleFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'kasir';
    const parsed = JSON.parse(raw);
    return parsed?.user?.role || parsed?.role || 'kasir';
  } catch {
    return 'kasir';
  }
}

// ====== (Opsional) Persist halaman via hash ======
function parseHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!raw) return { page: null, section: null };
  const [page, section] = raw.split(':');
  return { page: page || null, section: section || null };
}
function setHash(page, section = null, replace = true) {
  const next = `#${page}${section ? `:${section}` : ''}`;
  if (replace) window.history.replaceState(null, '', next);
  else window.location.hash = next;
}
function scrollToSection(section) {
  if (!section) return;
  requestAnimationFrame(() => {
    const el =
      document.getElementById(section) ||
      document.querySelector(`#${CSS?.escape ? CSS.escape(section) : section}`);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
}

export default function App() {
  // Auth & role
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [role, setRole] = useState(() => getRoleFromStorage());

  // Inisialisasi halaman dari hash (fallback 'pos')
  const init = parseHash();
  const [currentPage, setCurrentPage] = useState(init.page || 'pos');
  const [currentSection, setCurrentSection] = useState(init.section || null);

  // Daftar halaman yang boleh untuk role ini — SUMBER dari DEFAULT_ALLOWED (App saja)
  const allowedPages = useMemo(
    () => DEFAULT_ALLOWED[role] || DEFAULT_ALLOWED.kasir,
    [role]
  );

  // Jaga currentPage selalu valid untuk role saat ini
  useEffect(() => {
    if (!allowedPages.includes(currentPage)) {
      setCurrentPage(allowedPages[0]);
      setCurrentSection(null);
    }
  }, [allowedPages, currentPage]);

  // Sync hash & localStorage saat page/section berubah (opsional)
  useEffect(() => {
    setHash(currentPage, currentSection, true);
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage, currentSection]);

  // Reaksi ke perubahan hash (refresh/back/forward)
  useEffect(() => {
    const onHash = () => {
      const { page, section } = parseHash();
      if (page) setCurrentPage(page);
      setCurrentSection(section || null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Scroll ke section jika ada
  useEffect(() => {
    scrollToSection(currentSection);
  }, [currentPage, currentSection]);

  // Navigasi dari Sidebar — hanya izinkan yang ada di allowedPages
  const handleNavigate = (page) => {
    if (!allowedPages.includes(page)) return;
    setCurrentPage(page);
    setCurrentSection(null);
  };

  // Dipanggil halaman anak kalau mau loncat ke section & dipersist di URL
  const goToSection = (id) => setCurrentSection(id);

  const handleLogout = async () => {
    await logoutRequest();
    setLoggedIn(false);
    setRole('kasir');
    setCurrentPage('pos');
    setCurrentSection(null);
    setHash('pos', null, true);
  };

  // Sinkron antar-tab saat token/role berubah
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === process.env.REACT_APP_STORAGE_KEY) {
        setLoggedIn(isLoggedIn());
        setRole(getRoleFromStorage());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Setelah login, set role & arahkan ke halaman pertama yang diizinkan
  if (!loggedIn) {
    return (
      <LoginPages
        onLogin={() => {
          setLoggedIn(true);
          const r = getRoleFromStorage();
          setRole(r);
          const first = (DEFAULT_ALLOWED[r] || DEFAULT_ALLOWED.kasir)[0];
          setCurrentPage(currentPage);
          setHash(first, null, true);
        }}
      />
    );
  }

  // Render halaman sesuai currentPage
  let PageComponent = <POSPage goToSection={goToSection} />;
  switch (currentPage) {
    case 'home':
      PageComponent = <HomePage goToSection={goToSection} />;
      break;
    case 'pos':
      PageComponent = <POSPage goToSection={goToSection} />;
      break;
    case 'products':
      PageComponent = <ProductPage goToSection={goToSection} />;
      break;
    case 'inventory':
      PageComponent = <InventoryPage goToSection={goToSection} />;
      break;
    case 'purchase':
      PageComponent = <PurchasePage goToSection={goToSection} />;
      break;
    case 'history':
      PageComponent = <HistoryPage goToSection={goToSection} />;
      break;
    default:
      PageComponent = <POSPage goToSection={goToSection} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        userRole={role}
        allowedPages={allowedPages}   // <-- Sidebar cukup pakai ini, tanpa mapping internal
        onLogout={handleLogout}
      />
      <div className="flex-1 md:ml-24">
        {PageComponent}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
