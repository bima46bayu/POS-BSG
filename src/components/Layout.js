// import React, { useState } from 'react';
// import Sidebar from './Sidebar';
// import POSPage from '../pages/POSPage';
// import ProductPage from '../pages/ProductPage';
// import InventoryPage from '../pages/InventoryPage';
// import PurchasePage from '../pages/PurchasePage';
// import HistoryPage from '../pages/HistoryPage';
// import HomePage from '../pages/HomePage';

// const Layout = ({ onLogout, userRole = 'admin' }) => {
//   const [currentPage, setCurrentPage] = useState('home');

//   const handleNavigate = (page) => {
//     setCurrentPage(page);
//   };

//   // Function untuk render page yang sesuai
//   const renderCurrentPage = () => {
//     switch (currentPage) {
//       case 'home':
//         return <HomePage />;
//       case 'pos':
//         return <POSPage />;
//       case 'products':
//         return <ProductPage />;
//       case 'inventory':
//         return <InventoryPage />;
//       case 'purchase':
//         return <PurchasePage />;
//       case 'history':
//         return <HistoryPage />;
//       default:
//         return <POSPage />;
//     }
//   };

//   return (
//     <div className="flex min-h-screen">
//       <Sidebar
//         currentPage={currentPage}
//         onNavigate={handleNavigate}
//         userRole={userRole}
//         onLogout={onLogout}
//       />
//       <div className="flex-1 md:ml-24">
//         {renderCurrentPage()}
//       </div>
//     </div>
//   );
// };

// export default Layout;