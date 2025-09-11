// src/components/ui/Table/TableActions.js
import React from 'react';

// Status Badge Component
const StatusBadge = ({ status, variant = "default" }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-700 border-green-200';
      case 'qris': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'e-wallet': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'card': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'transfer': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!status) return null;

  return (
    <span className={`
      inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border
      ${getStatusColor(status)}
    `}>
      {status}
    </span>
  );
};

// Action Button Component
const ActionButton = ({ 
  children, 
  onClick, 
  variant = "primary",
  size = "sm",
  disabled = false,
  className = "",
  ...props 
}) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white"
  };

  const sizes = {
    xs: "px-2 py-1 text-xs",
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

// Main TableActions Component
const TableActions = ({ 
  actions = [], 
  status,
  row,
  className = "" 
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Badge */}
      {status && <StatusBadge status={status} />}
      
      {/* Action Buttons */}
      {actions.map((action, index) => (
        <ActionButton
          key={index}
          variant={action.variant || "primary"}
          size={action.size || "sm"}
          onClick={() => action.onClick && action.onClick(row)}
          disabled={action.disabled}
          className={action.className}
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.label}
        </ActionButton>
      ))}
    </div>
  );
};

// Export both components
export default TableActions;
export { StatusBadge, ActionButton };