import React, { useState, useEffect } from 'react';
import { loadTransactions } from '../utils/storage';
import { formatCurrency, formatDate } from '../utils/helpers';
import './Transactions.css';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    loadTransactionsData();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, dateFilter, searchQuery]);

  const loadTransactionsData = () => {
    const loadedTransactions = loadTransactions();
    setTransactions(loadedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        switch (dateFilter) {
          case 'today':
            return transactionDate >= startOfToday;
          case 'week':
            return transactionDate >= startOfWeek;
          case 'month':
            return transactionDate >= startOfMonth;
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(transaction =>
        transaction.id.toLowerCase().includes(query) ||
        transaction.customer.name.toLowerCase().includes(query) ||
        transaction.items.some(item => 
          item.name.toLowerCase().includes(query)
        )
      );
    }

    setFilteredTransactions(filtered);
  };

  const getTotalSales = () => {
    return filteredTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
  };

  const showTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  return (
    <div className="transactions-container">
      <div className="transactions-header">
        <h2>Transaction History</h2>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-value">{filteredTransactions.length}</div>
            <div className="stat-label">Transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(getTotalSales())}</div>
            <div className="stat-label">Total Sales</div>
          </div>
        </div>
      </div>

      <div className="transactions-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-section">
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="date-filter"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      <div className="transactions-list">
        {filteredTransactions.length === 0 ? (
          <div className="no-transactions">
            No transactions found.
          </div>
        ) : (
          filteredTransactions.map(transaction => (
            <div 
              key={transaction.id} 
              className="transaction-card"
              onClick={() => showTransactionDetails(transaction)}
            >
              <div className="transaction-header">
                <div className="transaction-id">#{transaction.id.slice(-8).toUpperCase()}</div>
                <div className="transaction-date">{formatDate(transaction.date)}</div>
              </div>
              
              <div className="transaction-info">
                <div className="customer-info">
                  <strong>{transaction.customer.name}</strong>
                </div>
                <div className="transaction-summary">
                  {transaction.items.length} item{transaction.items.length !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="transaction-total">
                {formatCurrency(transaction.total)}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTransaction && (
        <div className="modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Details</h3>
              <button 
                className="close-btn"
                onClick={() => setSelectedTransaction(null)}
              >
                ×
              </button>
            </div>
            
            <div className="transaction-details">
              <div className="detail-section">
                <h4>Transaction Info</h4>
                <div className="detail-row">
                  <span>Transaction ID:</span>
                  <span>#{selectedTransaction.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="detail-row">
                  <span>Date:</span>
                  <span>{formatDate(selectedTransaction.date)}</span>
                </div>
                <div className="detail-row">
                  <span>Customer:</span>
                  <span>{selectedTransaction.customer.name}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>Items</h4>
                <div className="items-list">
                  {selectedTransaction.items.map((item, index) => (
                    <div key={index} className="item-row">
                      <div className="item-info">
                        <div className="item-name">{item.name}</div>
                        <div className="item-details">
                          {item.quantity} × {formatCurrency(item.price)}
                        </div>
                      </div>
                      <div className="item-total">
                        {formatCurrency(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h4>Payment Summary</h4>
                <div className="payment-summary">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedTransaction.subtotal)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Tax:</span>
                    <span>{formatCurrency(selectedTransaction.tax)}</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedTransaction.total)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Paid:</span>
                    <span>{formatCurrency(selectedTransaction.payment)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Change:</span>
                    <span>{formatCurrency(selectedTransaction.change)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
