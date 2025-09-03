import React, { useState, useEffect } from 'react';
import { loadTransactions, loadProducts } from '../utils/storage';
import { formatCurrency, formatDate, calculateSalesStats } from '../utils/helpers';
import './Reports.css';

const Reports = () => {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [dateRange, setDateRange] = useState('today');
  const [salesStats, setSalesStats] = useState({});
  const [topProducts, setTopProducts] = useState([]);
  const [revenueByCategory, setRevenueByCategory] = useState([]);

  useEffect(() => {
    loadReportsData();
  }, []);

  useEffect(() => {
    generateReports();
  }, [transactions, products, dateRange]);

  const loadReportsData = () => {
    const loadedTransactions = loadTransactions();
    const loadedProducts = loadProducts();
    setTransactions(loadedTransactions);
    setProducts(loadedProducts);
  };

  const getFilteredTransactions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      switch (dateRange) {
        case 'today':
          return transactionDate >= today;
        case 'week':
          return transactionDate >= startOfWeek;
        case 'month':
          return transactionDate >= startOfMonth;
        case 'all':
        default:
          return true;
      }
    });
  };

  const generateReports = () => {
    const filteredTransactions = getFilteredTransactions();
    
    // Calculate sales statistics
    const stats = calculateSalesStats(filteredTransactions);
    setSalesStats(stats);

    // Calculate top-selling products
    const productSales = {};
    filteredTransactions.forEach(transaction => {
      transaction.items.forEach(item => {
        if (productSales[item.id]) {
          productSales[item.id].quantity += item.quantity;
          productSales[item.id].revenue += item.quantity * item.price;
        } else {
          productSales[item.id] = {
            ...item,
            quantity: item.quantity,
            revenue: item.quantity * item.price
          };
        }
      });
    });

    const topProductsList = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    setTopProducts(topProductsList);

    // Calculate revenue by category
    const categoryRevenue = {};
    filteredTransactions.forEach(transaction => {
      transaction.items.forEach(item => {
        const revenue = item.quantity * item.price;
        if (categoryRevenue[item.category]) {
          categoryRevenue[item.category] += revenue;
        } else {
          categoryRevenue[item.category] = revenue;
        }
      });
    });

    const categoryList = Object.entries(categoryRevenue)
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    setRevenueByCategory(categoryList);
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'all':
      default:
        return 'All Time';
    }
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Sales Reports</h2>
        <div className="date-range-selector">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-select"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div className="report-period">
        <h3>Report Period: {getDateRangeLabel()}</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(salesStats.totalSales || 0)}</div>
            <div className="stat-label">Total Sales</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{salesStats.totalTransactions || 0}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(salesStats.averageTransaction || 0)}</div>
            <div className="stat-label">Average Transaction</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-value">{topProducts.length > 0 ? topProducts[0].quantity : 0}</div>
            <div className="stat-label">Top Product Sales</div>
          </div>
        </div>
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <h3>Top Selling Products</h3>
          <div className="top-products-list">
            {topProducts.length === 0 ? (
              <div className="no-data">No sales data available</div>
            ) : (
              topProducts.map((product, index) => (
                <div key={product.id} className="product-item">
                  <div className="product-rank">#{index + 1}</div>
                  <div className="product-info">
                    <div className="product-name">{product.name}</div>
                    <div className="product-category">{product.category}</div>
                  </div>
                  <div className="product-stats">
                    <div className="quantity-sold">{product.quantity} sold</div>
                    <div className="revenue">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="report-card">
          <h3>Revenue by Category</h3>
          <div className="category-revenue-list">
            {revenueByCategory.length === 0 ? (
              <div className="no-data">No revenue data available</div>
            ) : (
              revenueByCategory.map((item, index) => (
                <div key={item.category} className="category-item">
                  <div className="category-info">
                    <div className="category-name">{item.category}</div>
                    <div className="category-bar">
                      <div 
                        className="category-progress"
                        style={{
                          width: `${(item.revenue / revenueByCategory[0].revenue) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="category-revenue">
                    {formatCurrency(item.revenue)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="recent-transactions-card">
        <h3>Recent Transactions</h3>
        <div className="recent-transactions-list">
          {getFilteredTransactions().slice(0, 10).map(transaction => (
            <div key={transaction.id} className="transaction-item">
              <div className="transaction-id">
                #{transaction.id.slice(-8).toUpperCase()}
              </div>
              <div className="transaction-info">
                <div className="transaction-customer">{transaction.customer.name}</div>
                <div className="transaction-date">{formatDate(transaction.date)}</div>
              </div>
              <div className="transaction-total">
                {formatCurrency(transaction.total)}
              </div>
            </div>
          ))}
          {getFilteredTransactions().length === 0 && (
            <div className="no-data">No transactions in selected period</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
