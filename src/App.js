import React, { useState, useEffect } from 'react';
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

import { isLoggedIn, logoutRequest } from './api/auth'; // <— ADD

function App() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());       // <— CHANGE
  const [currentPage, setCurrentPage] = useState('pos');

  const handleNavigate = (page) => setCurrentPage(page);

  const handleLogout = async () => {                                  // <— CHANGE
    await logoutRequest();
    setLoggedIn(false);
    setCurrentPage('pos');
  };

  // Sinkron antar-tab & saat localStorage berubah (mis. interceptor 401 menghapus token)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === process.env.REACT_APP_STORAGE_KEY) {
        setLoggedIn(isLoggedIn());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!loggedIn) {
    return <LoginPages onLogin={() => setLoggedIn(true)} />;
  }

  let PageComponent;
  switch (currentPage) {
    case 'home': PageComponent = <HomePage />; break;
    case 'pos': PageComponent = <POSPage />; break;
    case 'products': PageComponent = <ProductPage />; break;
    case 'inventory': PageComponent = <InventoryPage />; break;
    case 'purchase': PageComponent = <PurchasePage />; break;
    case 'history': PageComponent = <HistoryPage />; break;
    default: PageComponent = <POSPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        userRole="admin"
        onLogout={handleLogout}
      />
      <div className="flex-1 md:ml-24">
        {PageComponent}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
