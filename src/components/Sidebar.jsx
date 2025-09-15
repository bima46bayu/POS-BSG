import React, { useState, useEffect } from 'react';
import { 
  Home, 
  CreditCard, 
  Package, 
  Archive, 
  ShoppingCart, 
  Clock, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

const Sidebar = ({ currentPage, onNavigate, userRole, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when screen gets larger
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      visible: true
    },
    {
      id: 'pos',
      label: 'POS',
      icon: CreditCard,
      visible: true
    },
    {
      id: 'products',
      label: 'Product',
      icon: Package,
      visible: true
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Archive,
      visible: true
    },
    {
      id: 'purchase',
      label: 'Purchase',
      icon: ShoppingCart,
      visible: true
    },
    {
      id: 'history',
      label: 'History',
      icon: Clock,
      visible: true
    }
  ];

  const handleNavigate = (pageId) => {
    onNavigate(pageId);
    setIsMobileMenuOpen(false); // Close mobile menu after navigation
  };

  const handleLogout = () => {
    onLogout();
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`
          md:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-xl shadow-lg border border-gray-200 
          hover:bg-gray-50 transition-all duration-200
          ${isMobileMenuOpen ? 'bg-gray-100' : ''}
        `}
      >
        <Menu size={22} className="text-gray-700" />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-24 bg-white shadow-lg flex-col items-center py-6 border-r border-gray-200 h-screen fixed top-0 left-0 z-30">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <div className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold">BSG</div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col space-y-4 flex-1">
          {menuItems.map((item) => {
            if (!item.visible) return null;
            
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`
                  relative flex flex-col items-center justify-center px-2 h-14 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r"></div>
                )}
                
                <Icon size={24} className="mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="mt-auto pt-8">
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center px-2 h-14 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut size={24} className="mb-1" />
            <span className="text-xs font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="md:hidden">
        {/* Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Mobile Sidebar */}
        <div className={`
          fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header with close button */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <div className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs font-bold">BSG</div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">POS System</h2>
                <p className="text-sm text-gray-500">SHITPOS</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={22} className="text-gray-500" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="p-4">
            {menuItems.map((item) => {
              if (!item.visible) return null;
              
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`
                    w-full flex items-center space-x-4 px-4 py-4 rounded-xl transition-all duration-200 mb-2
                    ${isActive 
                      ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }
                  `}
                >
                  <Icon size={22} />
                  <span className="font-medium text-base">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sign Out at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-4 px-4 py-4 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={22} />
              <span className="font-medium text-base">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;