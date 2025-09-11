import React, { useState, useCallback, useMemo } from 'react';
import SearchBar from '../components/pos/SearchBar';
import ProductGrid from '../components/pos/ProductGrid';
import OrderDetails from '../components/pos/OrderDetails';
import OrderSummary from '../components/pos/OrderSummary';
import Payment from '../components/pos/Payment';

const POSPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [products] = useState([
    { id: 1, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 2, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 3, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 4, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 5, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 6, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 7, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 8, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 9, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 10, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 11, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
    { id: 12, name: 'Kaos Logo', price: 100000, image: '/api/placeholder/150/150' },
  ]);

  const handleAddToCart = useCallback((product) => {
    setCartItems((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      return exist
        ? prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const handleUpdateQuantity = useCallback((id, change) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const q = item.quantity + change;
          return q > 0 ? { ...item, quantity: q } : null;
        })
        .filter(Boolean)
    );
  }, []);

  const handleRemoveItem = useCallback((id) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handlePayment = useCallback((paymentData) => {
    console.log('Payment processed:', paymentData);
    setCartItems([]);
    alert('Payment successful!');
  }, []);

  const handleCancel = useCallback(() => setCartItems([]), []);
  const handleSearch = useCallback((q) => console.log('Search:', q), []);
  const handleFilter = useCallback(() => console.log('Filter clicked'), []);
  const handleScan = useCallback(() => console.log('Scanner activated'), []);

  const subtotal = useMemo(() => cartItems.reduce((s, i) => s + i.price * i.quantity, 0), [cartItems]);
  const tax = useMemo(() => Math.round(subtotal * 0.11), [subtotal]);
  const total = subtotal + tax;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50">
      {/* Main Content */}
      <main className="order-1 flex-1 p-4 sm:p-5 md:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <SearchBar onSearch={handleSearch} onFilter={handleFilter} onScan={handleScan} />
          <ProductGrid products={products} onAddToCart={handleAddToCart} />
        </div>
      </main>

      {/* Order Panel */}
      <aside
        className="
          order-2 w-full md:w-[340px] lg:w-[400px] xl:w-[480px]
          bg-white border-t md:border-t-0 md:border-l border-gray-200
          p-4 sm:p-5 md:p-6
          overflow-y-auto
          md:sticky md:top-0 md:h-screen
        "
      >
        <OrderDetails
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />
        <OrderSummary items={cartItems} />
        <Payment total={total} onPayment={handlePayment} onCancel={handleCancel} />
      </aside>
    </div>
  );
};

export default POSPage;
