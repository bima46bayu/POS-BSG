import { format } from 'date-fns';

// Format currency
export const formatCurrency = (amount, currency = '$') => {
  return `${currency}${amount.toFixed(2)}`;
};

// Generate unique ID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Format date
export const formatDate = (date) => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

// Calculate tax
export const calculateTax = (amount, taxRate) => {
  return amount * taxRate;
};

// Calculate total with tax
export const calculateTotal = (subtotal, taxRate) => {
  const tax = calculateTax(subtotal, taxRate);
  return subtotal + tax;
};

// Search products
export const searchProducts = (products, query) => {
  if (!query) return products;
  
  const searchTerm = query.toLowerCase();
  return products.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    product.category.toLowerCase().includes(searchTerm) ||
    product.barcode.includes(searchTerm)
  );
};

// Validate product data
export const validateProduct = (product) => {
  const errors = {};
  
  if (!product.name || product.name.trim() === '') {
    errors.name = 'Product name is required';
  }
  
  if (!product.price || product.price <= 0) {
    errors.price = 'Price must be greater than 0';
  }
  
  if (product.stock === undefined || product.stock < 0) {
    errors.stock = 'Stock cannot be negative';
  }
  
  if (!product.category || product.category.trim() === '') {
    errors.category = 'Category is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Calculate sales statistics
export const calculateSalesStats = (transactions) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayTransactions = transactions.filter(t => 
    new Date(t.date) >= today
  );
  
  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = transactions.length;
  const todayTransactions_count = todayTransactions.length;
  
  return {
    totalSales,
    todaySales,
    totalTransactions,
    todayTransactions: todayTransactions_count,
    averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0
  };
};
