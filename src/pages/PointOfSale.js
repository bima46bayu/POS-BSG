import React, { useState, useEffect } from 'react';
import { loadProducts, loadCustomers, saveTransactions, loadTransactions } from '../utils/storage';
import { formatCurrency, generateId, calculateTotal, searchProducts } from '../utils/helpers';
import './PointOfSale.css';

const PointOfSale = () => {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  
  const taxRate = 0.1; // 10% tax

  useEffect(() => {
    const loadedProducts = loadProducts();
    const loadedCustomers = loadCustomers();
    setProducts(loadedProducts);
    setCustomers(loadedCustomers);
    setFilteredProducts(loadedProducts);
    if (loadedCustomers.length > 0) {
      setSelectedCustomer(loadedCustomers[0]); // Default to walk-in customer
    }
  }, []);

  useEffect(() => {
    setFilteredProducts(searchProducts(products, searchQuery));
  }, [searchQuery, products]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('Product out of stock!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Not enough stock available!');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (quantity > product.stock) {
      alert('Not enough stock available!');
      return;
    }

    setCart(cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const processPayment = () => {
    const subtotal = calculateSubtotal();
    const total = calculateTotal(subtotal, taxRate);
    const payment = parseFloat(paymentAmount);

    if (payment < total) {
      alert('Insufficient payment amount!');
      return;
    }

    // Create transaction
    const transaction = {
      id: generateId(),
      date: new Date().toISOString(),
      customer: selectedCustomer,
      items: cart,
      subtotal,
      tax: subtotal * taxRate,
      total,
      payment,
      change: payment - total
    };

    // Save transaction
    const transactions = loadTransactions();
    transactions.push(transaction);
    saveTransactions(transactions);

    // Update product stock
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.id === product.id);
      if (cartItem) {
        return { ...product, stock: product.stock - cartItem.quantity };
      }
      return product;
    });
    
    // You would typically save the updated products here
    // For now, we'll just update the local state
    setProducts(updatedProducts);

    // Show receipt and reset
    alert(`Transaction completed!\nTotal: ${formatCurrency(total)}\nPaid: ${formatCurrency(payment)}\nChange: ${formatCurrency(payment - total)}`);
    
    setCart([]);
    setPaymentAmount('');
    setShowPayment(false);
  };

  const subtotal = calculateSubtotal();
  const tax = subtotal * taxRate;
  const total = calculateTotal(subtotal, taxRate);

  return (
    <div className="pos-container">
      <div className="pos-left">
        <div className="product-search">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="product-grid">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className={`product-card ${product.stock <= 0 ? 'out-of-stock' : ''}`}
              onClick={() => addToCart(product)}
            >
              <div className="product-name">{product.name}</div>
              <div className="product-price">{formatCurrency(product.price)}</div>
              <div className="product-stock">Stock: {product.stock}</div>
              <div className="product-category">{product.category}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pos-right">
        <div className="cart-section">
          <h3>Cart</h3>
          
          <div className="customer-select">
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(customer);
              }}
            >
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">Cart is empty</div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-price">{formatCurrency(item.price)}</div>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>-</button>
                    <span className="item-quantity">{item.quantity}</span>
                    <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                    <button 
                      className="remove-btn"
                      onClick={() => removeFromCart(item.id)}
                    >×</button>
                  </div>
                  <div className="item-total">
                    {formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="cart-summary">
            <div className="summary-line">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary-line">
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="summary-line total">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="checkout-section">
              {!showPayment ? (
                <button 
                  className="checkout-btn"
                  onClick={() => setShowPayment(true)}
                >
                  Checkout
                </button>
              ) : (
                <div className="payment-section">
                  <input
                    type="number"
                    placeholder="Payment amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="payment-input"
                    step="0.01"
                    min={total}
                  />
                  <div className="payment-buttons">
                    <button 
                      className="pay-btn"
                      onClick={processPayment}
                      disabled={!paymentAmount || parseFloat(paymentAmount) < total}
                    >
                      Complete Sale
                    </button>
                    <button 
                      className="cancel-btn"
                      onClick={() => setShowPayment(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  {paymentAmount && parseFloat(paymentAmount) >= total && (
                    <div className="change-display">
                      Change: {formatCurrency(parseFloat(paymentAmount) - total)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointOfSale;
