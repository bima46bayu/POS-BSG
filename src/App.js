import React, { useState, useEffect } from 'react';
import './App.css';
import LoginPages from './components/LoginPages';
import Sidebar from './components/Sidebar';
import POSPage from './pages/POSPage';
import ProductPage from './pages/ProductPage';
import InventoryPage from './pages/InventoryPage';
import PurchasePage from './pages/PurchasePage';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';

function App() {
  // Ambil status login dari localStorage saat pertama kali render
  const [loggedIn, setLoggedIn] = useState(() => {
    return localStorage.getItem('loggedIn') === 'true';
  });
  const [currentPage, setCurrentPage] = useState('pos');

  const handleNavigate = (page) => setCurrentPage(page);
  const handleLogout = () => {
    setLoggedIn(false);
    localStorage.removeItem('loggedIn');
    setCurrentPage('pos');
  };

  // Simpan status login ke localStorage setiap kali berubah
  useEffect(() => {
    localStorage.setItem('loggedIn', loggedIn);
  }, [loggedIn]);

  if (!loggedIn) {
    return <LoginPages onLogin={() => setLoggedIn(true)} />;
  }

  let PageComponent;
  switch (currentPage) {
    case 'home':
      PageComponent = <HomePage />; // Ganti dengan <HomePage /> jika ada
      break;
    case 'pos':
      PageComponent = <POSPage />;
      break;
    case 'products':
      PageComponent = <ProductPage />;
      break;
    case 'inventory':
      PageComponent = <InventoryPage />;
      break;
    case 'purchase':
      PageComponent = <PurchasePage />;
      break;
    case 'history':
      PageComponent = <HistoryPage />;
      break;
    default:
      PageComponent = <POSPage />;
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
    </div>
  );
}

export default App;