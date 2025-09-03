import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PointOfSale from './pages/PointOfSale';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import { initializeSampleData } from './utils/storage';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('pos');

  useEffect(() => {
    // Initialize sample data on first load
    initializeSampleData();
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'pos':
        return <PointOfSale />;
      case 'products':
        return <Products />;
      case 'inventory':
        return <Inventory />;
      case 'transactions':
        return <Transactions />;
      case 'customers':
        return <Customers />;
      case 'reports':
        return <Reports />;
      default:
        return <PointOfSale />;
    }
  };

  return (
    <div className="App">
      <Navbar currentView={currentView} onViewChange={setCurrentView} />
      <main className="main-content">
        {renderCurrentView()}
      </main>
    </div>
  );
}

export default App;
