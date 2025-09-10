import React from 'react';
import { 
  Home, 
  CreditCard, 
  Package, 
  Archive, 
  ShoppingCart, 
  Clock, 
  LogOut 
} from 'lucide-react';

const Sidebar = ({ currentPage, onNavigate, userRole, onLogout }) => {
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
      // visible: userRole === 'admin'
    },
    {
      id: 'purchase',
      label: 'Purchase',
      icon: ShoppingCart,
      visible: true
      // visible: userRole === 'admin'
    },
    {
      id: 'history',
      label: 'History',
      icon: Clock,
      visible: true
    }
  ];

  return (
    <div className="w-20 bg-white shadow-lg flex flex-col items-center py-6 border-r border-gray-200 h-screen">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="text-blue-600 font-bold text-sm">
            <div className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs">BSG</div>
          </div>
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
              onClick={() => onNavigate(item.id)}
              className={`
                relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200
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

      {/* Sign Out - di paling bawah dengan jarak */}
      <div className="mt-auto pt-8">
        <button
          onClick={onLogout}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut size={24} className="mb-1" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;