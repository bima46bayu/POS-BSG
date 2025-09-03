// Local storage utilities for PoS data
const STORAGE_KEYS = {
  PRODUCTS: 'pos_products',
  TRANSACTIONS: 'pos_transactions',
  CUSTOMERS: 'pos_customers',
  SETTINGS: 'pos_settings'
};

// Generic storage functions
export const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
};

export const loadData = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('Error loading data:', error);
    return defaultValue;
  }
};

// Product management
export const saveProducts = (products) => saveData(STORAGE_KEYS.PRODUCTS, products);
export const loadProducts = () => loadData(STORAGE_KEYS.PRODUCTS, []);

// Transaction management
export const saveTransactions = (transactions) => saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
export const loadTransactions = () => loadData(STORAGE_KEYS.TRANSACTIONS, []);

// Customer management
export const saveCustomers = (customers) => saveData(STORAGE_KEYS.CUSTOMERS, customers);
export const loadCustomers = () => loadData(STORAGE_KEYS.CUSTOMERS, []);

// Settings management
export const saveSettings = (settings) => saveData(STORAGE_KEYS.SETTINGS, settings);
export const loadSettings = () => loadData(STORAGE_KEYS.SETTINGS, {
  storeName: 'My Store',
  taxRate: 0.1,
  currency: '$'
});

// Initialize with sample data if empty
export const initializeSampleData = () => {
  const products = loadProducts();
  if (products.length === 0) {
    const sampleProducts = [
      {
        id: '1',
        name: 'Coffee',
        price: 2.50,
        stock: 100,
        category: 'Beverages',
        barcode: '1234567890123'
      },
      {
        id: '2',
        name: 'Sandwich',
        price: 5.99,
        stock: 50,
        category: 'Food',
        barcode: '1234567890124'
      },
      {
        id: '3',
        name: 'Water Bottle',
        price: 1.25,
        stock: 200,
        category: 'Beverages',
        barcode: '1234567890125'
      },
      {
        id: '4',
        name: 'Chocolate Bar',
        price: 1.99,
        stock: 75,
        category: 'Snacks',
        barcode: '1234567890126'
      }
    ];
    saveProducts(sampleProducts);
  }

  const customers = loadCustomers();
  if (customers.length === 0) {
    const sampleCustomers = [
      {
        id: '1',
        name: 'Walk-in Customer',
        email: '',
        phone: '',
        totalPurchases: 0
      }
    ];
    saveCustomers(sampleCustomers);
  }
};
