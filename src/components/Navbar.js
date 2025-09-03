import React from 'react';
import './Navbar.css';

const Navbar = ({ currentView, onViewChange }) => {
  const menuItems = [
    { id: 'pos', label: 'Point of Sale', icon: '💳' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'inventory', label: 'Inventory', icon: '📊' },
    { id: 'transactions', label: 'Transactions', icon: '🧾' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>🏪 PoS System</h2>
      </div>
      <div className="navbar-menu">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`navbar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="navbar-icon">{item.icon}</span>
            <span className="navbar-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
