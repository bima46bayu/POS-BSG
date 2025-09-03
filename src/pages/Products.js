import React, { useState, useEffect } from 'react';
import { loadProducts, saveProducts } from '../utils/storage';
import { formatCurrency, generateId, validateProduct, searchProducts } from '../utils/helpers';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    barcode: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadProductsData();
  }, []);

  useEffect(() => {
    setFilteredProducts(searchProducts(products, searchQuery));
  }, [searchQuery, products]);

  const loadProductsData = () => {
    const loadedProducts = loadProducts();
    setProducts(loadedProducts);
    setFilteredProducts(loadedProducts);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      stock: '',
      category: '',
      barcode: ''
    });
    setFormErrors({});
    setEditingProduct(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      barcode: product.barcode
    });
    setEditingProduct(product);
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const productData = {
      name: formData.name.trim(),
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      category: formData.category.trim(),
      barcode: formData.barcode.trim()
    };

    const validation = validateProduct(productData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    // Check for duplicate barcode
    const existingProduct = products.find(p => 
      p.barcode === productData.barcode && p.id !== editingProduct?.id
    );
    if (existingProduct) {
      setFormErrors({ barcode: 'Barcode already exists' });
      return;
    }

    let updatedProducts;
    if (editingProduct) {
      // Update existing product
      updatedProducts = products.map(p =>
        p.id === editingProduct.id ? { ...productData, id: editingProduct.id } : p
      );
    } else {
      // Add new product
      const newProduct = {
        ...productData,
        id: generateId()
      };
      updatedProducts = [...products, newProduct];
    }

    setProducts(updatedProducts);
    saveProducts(updatedProducts);
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const updatedProducts = products.filter(p => p.id !== productId);
      setProducts(updatedProducts);
      saveProducts(updatedProducts);
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>Product Management</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button className="add-btn" onClick={openAddModal}>
            + Add Product
          </button>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.map(product => (
          <div key={product.id} className="product-card">
            <div className="product-header">
              <h3>{product.name}</h3>
              <div className="product-actions">
                <button 
                  className="edit-btn"
                  onClick={() => openEditModal(product)}
                >
                  ✏️
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(product.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="product-details">
              <div className="product-price">{formatCurrency(product.price)}</div>
              <div className="product-stock">
                Stock: <span className={product.stock <= 10 ? 'low-stock' : ''}>{product.stock}</span>
              </div>
              <div className="product-category">{product.category}</div>
              <div className="product-barcode">#{product.barcode}</div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="no-products">
          {searchQuery ? 'No products found matching your search.' : 'No products available. Add your first product!'}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={formErrors.name ? 'error' : ''}
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label>Price *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={formErrors.price ? 'error' : ''}
                />
                {formErrors.price && <span className="error-text">{formErrors.price}</span>}
              </div>

              <div className="form-group">
                <label>Stock Quantity *</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  min="0"
                  className={formErrors.stock ? 'error' : ''}
                />
                {formErrors.stock && <span className="error-text">{formErrors.stock}</span>}
              </div>

              <div className="form-group">
                <label>Category *</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  list="categories"
                  className={formErrors.category ? 'error' : ''}
                />
                <datalist id="categories">
                  {categories.map(category => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                {formErrors.category && <span className="error-text">{formErrors.category}</span>}
              </div>

              <div className="form-group">
                <label>Barcode</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  className={formErrors.barcode ? 'error' : ''}
                />
                {formErrors.barcode && <span className="error-text">{formErrors.barcode}</span>}
              </div>

              <div className="form-actions">
                <button type="submit" className="save-btn">
                  {editingProduct ? 'Update Product' : 'Add Product'}
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

export default Products;
