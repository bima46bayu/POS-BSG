import React, { useState, useEffect } from 'react';
import { loadProducts, saveProducts } from '../utils/storage';
import { formatCurrency } from '../utils/helpers';
import './Inventory.css';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInventoryData();
  }, []);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, filterType, sortBy, searchQuery]);

  const loadInventoryData = () => {
    const loadedProducts = loadProducts();
    setProducts(loadedProducts);
  };

  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Filter by stock level
    switch (filterType) {
      case 'low':
        filtered = filtered.filter(product => product.stock <= 10);
        break;
      case 'out':
        filtered = filtered.filter(product => product.stock === 0);
        break;
      case 'in-stock':
        filtered = filtered.filter(product => product.stock > 0);
        break;
      default:
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'stock':
          return a.stock - b.stock;
        case 'price':
          return a.price - b.price;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const updateStock = (productId, newStock) => {
    const stock = parseInt(newStock);
    if (isNaN(stock) || stock < 0) return;

    const updatedProducts = products.map(product =>
      product.id === productId ? { ...product, stock } : product
    );
    
    setProducts(updatedProducts);
    saveProducts(updatedProducts);
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return 'out-of-stock';
    if (stock <= 10) return 'low-stock';
    return 'in-stock';
  };

  const getStockLabel = (stock) => {
    if (stock === 0) return 'Out of Stock';
    if (stock <= 10) return 'Low Stock';
    return 'In Stock';
  };

  const getTotalValue = () => {
    return filteredProducts.reduce((sum, product) => sum + (product.price * product.stock), 0);
  };

  const getLowStockCount = () => {
    return products.filter(product => product.stock <= 10 && product.stock > 0).length;
  };

  const getOutOfStockCount = () => {
    return products.filter(product => product.stock === 0).length;
  };

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-value">{products.length}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card low-stock">
            <div className="stat-value">{getLowStockCount()}</div>
            <div className="stat-label">Low Stock</div>
          </div>
          <div className="stat-card out-of-stock">
            <div className="stat-value">{getOutOfStockCount()}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(getTotalValue())}</div>
            <div className="stat-label">Total Value</div>
          </div>
        </div>
      </div>

      <div className="inventory-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-section">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Products</option>
            <option value="in-stock">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="name">Sort by Name</option>
            <option value="stock">Sort by Stock</option>
            <option value="price">Sort by Price</option>
            <option value="category">Sort by Category</option>
          </select>
        </div>
      </div>

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Current Stock</th>
              <th>Status</th>
              <th>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className={getStockStatus(product.stock)}>
                <td>
                  <div className="product-info">
                    <div className="product-name">{product.name}</div>
                    <div className="product-barcode">#{product.barcode}</div>
                  </div>
                </td>
                <td>
                  <span className="category-badge">{product.category}</span>
                </td>
                <td className="price-cell">{formatCurrency(product.price)}</td>
                <td>
                  <input
                    type="number"
                    value={product.stock}
                    onChange={(e) => updateStock(product.id, e.target.value)}
                    className="stock-input"
                    min="0"
                  />
                </td>
                <td>
                  <span className={`status-badge ${getStockStatus(product.stock)}`}>
                    {getStockLabel(product.stock)}
                  </span>
                </td>
                <td className="value-cell">
                  {formatCurrency(product.price * product.stock)}
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="restock-btn"
                      onClick={() => {
                        const amount = prompt('Enter restock amount:');
                        if (amount && !isNaN(amount)) {
                          updateStock(product.id, product.stock + parseInt(amount));
                        }
                      }}
                    >
                      Restock
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="no-products">
            No products found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
