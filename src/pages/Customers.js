import React, { useState, useEffect } from 'react';
import { loadCustomers, saveCustomers } from '../utils/storage';
import { generateId } from '../utils/helpers';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    loadCustomersData();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery]);

  const loadCustomersData = () => {
    const loadedCustomers = loadCustomers();
    setCustomers(loadedCustomers);
  };

  const filterCustomers = () => {
    if (!searchQuery) {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(query)
      );
      setFilteredCustomers(filtered);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '' });
    setEditingCustomer(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone
    });
    setEditingCustomer(customer);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Customer name is required');
      return;
    }

    let updatedCustomers;
    if (editingCustomer) {
      updatedCustomers = customers.map(c =>
        c.id === editingCustomer.id 
          ? { ...editingCustomer, ...formData }
          : c
      );
    } else {
      const newCustomer = {
        id: generateId(),
        ...formData,
        totalPurchases: 0
      };
      updatedCustomers = [...customers, newCustomer];
    }

    setCustomers(updatedCustomers);
    saveCustomers(updatedCustomers);
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (customerId) => {
    if (customerId === '1') {
      alert('Cannot delete the default walk-in customer');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this customer?')) {
      const updatedCustomers = customers.filter(c => c.id !== customerId);
      setCustomers(updatedCustomers);
      saveCustomers(updatedCustomers);
    }
  };

  return (
    <div className="customers-container">
      <div className="customers-header">
        <h2>Customer Management</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button className="add-btn" onClick={openAddModal}>
            + Add Customer
          </button>
        </div>
      </div>

      <div className="customers-stats">
        <div className="stat-card">
          <div className="stat-value">{customers.length}</div>
          <div className="stat-label">Total Customers</div>
        </div>
      </div>

      <div className="customers-grid">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="customer-card">
            <div className="customer-header">
              <div className="customer-avatar">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="customer-info">
                <h3>{customer.name}</h3>
                <div className="customer-contact">
                  {customer.email && <div>📧 {customer.email}</div>}
                  {customer.phone && <div>📱 {customer.phone}</div>}
                </div>
              </div>
              {customer.id !== '1' && (
                <div className="customer-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => openEditModal(customer)}
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(customer.id)}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
            <div className="customer-stats">
              <div className="purchase-count">
                Purchases: {customer.totalPurchases || 0}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="no-customers">
          {searchQuery ? 'No customers found matching your search.' : 'No customers available.'}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="customer-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="save-btn">
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
