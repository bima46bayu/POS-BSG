import React, { useState } from 'react';
import { DataTable } from '../components/data-table';
import { Calendar, Download, Filter, X, Edit, Trash2, Plus, Package } from 'lucide-react';

const PurchasePage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // State untuk konfirmasi GR
  const [showGRConfirmation, setShowGRConfirmation] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Sample data dengan status GR
  const [purchaseData, setPurchaseData] = useState([
    {
      id: 1,
      purchaseNumber: 'POS-20250909-0001',
      tanggal: '09 Sep 2025 09:44',
      productName: 'General Product A',
      supplier: 'General Supplier',
      amount: '5',
      price: 'Rp100.000',
      contactSupplier: '081234567890',
      subTotal: 'Rp500.000',
      grStatus: false, // false = belum GR, true = sudah GR
    },
    {
      id: 2,
      purchaseNumber: 'POS-20250909-0002',
      tanggal: '09 Sep 2025 10:15',
      productName: 'General Product B',
      supplier: 'General Supplier',
      amount: '3',
      price: 'Rp150.000',
      contactSupplier: '081234567891',
      subTotal: 'Rp450.000',
      grStatus: true, // sudah di-GR
    },
    {
      id: 3,
      purchaseNumber: 'POS-20250909-0003',
      tanggal: '09 Sep 2025 11:30',
      productName: 'General Product C',
      supplier: 'General Supplier',
      amount: '2',
      price: 'Rp75.000',
      contactSupplier: '081234567892',
      subTotal: 'Rp150.000',
      grStatus: false,
    },
    {
      id: 4,
      purchaseNumber: 'POS-20250909-0004',
      tanggal: '09 Sep 2025 12:45',
      productName: 'General Product D',
      supplier: 'General Supplier',
      amount: '1',
      price: 'Rp200.000',
      contactSupplier: '081234567893',
      subTotal: 'Rp200.000',
      grStatus: false,
    },
    {
      id: 5,
      purchaseNumber: 'POS-20250909-0005',
      tanggal: '09 Sep 2025 13:20',
      productName: 'General Product E',
      supplier: 'General Supplier',
      amount: '4',
      price: 'Rp120.000',
      contactSupplier: '081234567894',
      subTotal: 'Rp480.000',
      grStatus: true,
    },
    // Tambahkan lebih banyak data untuk testing pagination
    ...Array.from({ length: 15 }, (_, i) => ({
      id: i + 6,
      purchaseNumber: `POS-20250909-${String(i + 6).padStart(4, '0')}`,
      tanggal: '09 Sep 2025 14:00',
      productName: `General Product ${String.fromCharCode(70 + i)}`,
      supplier: 'General Supplier',
      amount: '2',
      price: 'Rp100.000',
      contactSupplier: '081234567890',
      subTotal: 'Rp200.000',
      grStatus: Math.random() > 0.5, // random GR status
    }))
  ]);

  const columns = [
    {
      key: 'purchaseNumber',
      label: 'Purchase Number',
      sticky: 'left',
      sortable: true,
      minWidth: '200px',
      className: 'font-medium text-gray-900'
    },
    {
      key: 'tanggal',
      label: 'Tanggal',
      sortable: true,
      minWidth: '150px',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{value}</span>
        </div>
      )
    },
    {
      key: 'productName',
      label: 'Product Name',
      sortable: true,
      minWidth: '160px'
    },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: true,
      minWidth: '140px'
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      minWidth: '100px',
      className: 'font-medium text-gray-900',
      sortable: true
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      minWidth: '120px',
      className: 'font-medium text-gray-900',
      sortable: true
    },
    {
      key: 'contactSupplier',
      label: 'Contact Supplier',
      align: 'center',
      minWidth: '140px'
    },
    {
      key: 'subTotal',
      label: 'Sub Total',
      align: 'right',
      minWidth: '130px',
      className: 'font-medium text-gray-900',
      sortable: true
    },
    {
      key: 'grStatus',
      label: 'Status',
      align: 'center',
      minWidth: '100px',
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
          value 
            ? 'bg-green-100 text-green-800 border-green-200' 
            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }`}>
          {value ? 'GR Done' : 'Pending'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Action',
      sticky: 'right',
      align: 'center',
      minWidth: '180px',
      render: (value, row) => (
        <div className="flex items-center justify-center gap-1">
          {/* Edit Button */}
          <button
            onClick={() => handleEdit(row)}
            className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
            title="Edit Purchase"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          {/* GR Button - Hijau jika belum GR, Abu-abu jika sudah GR */}
          <button
            onClick={() => handleGR(row)}
            disabled={row.grStatus}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg focus:ring-2 focus:ring-offset-1 transition-colors ${
              row.grStatus 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
            }`}
            title={row.grStatus ? "GR Already Done" : "Goods Receipt"}
          >
            <Package className="w-4 h-4" />
          </button>
          
          {/* Delete Button */}
          <button
            onClick={() => handleDelete(row)}
            className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
            title="Delete Purchase"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Filter data berdasarkan search term
  const filteredData = purchaseData.filter(item =>
    item.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Handler Functions
  const handleEdit = (row) => {
    console.log('Edit purchase:', row.purchaseNumber);
    // TODO: Implement edit functionality
  };

  const handleGR = (row) => {
    if (row.grStatus) return; // Sudah di-GR, tidak bisa lagi
    
    setSelectedPurchase(row);
    setShowGRConfirmation(true);
  };

  const confirmGR = () => {
    if (!selectedPurchase) return;

    // Update status GR di data
    setPurchaseData(prevData => 
      prevData.map(item => 
        item.id === selectedPurchase.id 
          ? { ...item, grStatus: true }
          : item
      )
    );

    console.log('GR confirmed for:', selectedPurchase.purchaseNumber);
    console.log('Adding stock:', {
      product: selectedPurchase.productName,
      amount: selectedPurchase.amount,
      supplier: selectedPurchase.supplier
    });

    // TODO: Implement actual stock addition logic here
    // Example API call:
    // addToInventory({
    //   productName: selectedPurchase.productName,
    //   quantity: selectedPurchase.amount,
    //   supplier: selectedPurchase.supplier,
    //   purchaseNumber: selectedPurchase.purchaseNumber
    // });

    alert(`Stock added: ${selectedPurchase.amount} units of ${selectedPurchase.productName}`);

    setShowGRConfirmation(false);
    setSelectedPurchase(null);
  };

  const cancelGR = () => {
    setShowGRConfirmation(false);
    setSelectedPurchase(null);
  };

  const handleDelete = (row) => {
    console.log('Delete purchase:', row.purchaseNumber);
    if (window.confirm(`Are you sure you want to delete purchase ${row.purchaseNumber}?`)) {
      setPurchaseData(prevData => prevData.filter(item => item.id !== row.id));
      console.log('Deleted:', row.purchaseNumber);
    }
  };

  const handleAddPurchase = () => {
    console.log('Add new purchase');
    // TODO: Implement add purchase functionality
  };

  const handleExport = () => {
    console.log('Export purchase data');
    // TODO: Implement export functionality
  };

  // Filter Component
  const FilterComponent = () => (
    <div className="relative">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <Filter className="w-4 h-4" />
        Filter
      </button>

      {showFilters && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Suppliers</option>
                  <option value="General">General Supplier</option>
                  <option value="Supplier A">Supplier A</option>
                  <option value="Supplier B">Supplier B</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GR Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending GR</option>
                  <option value="done">GR Done</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setDateRange({ start: '', end: '' });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Action Buttons Component
  const ActionButtons = () => (
    <div className="flex items-center gap-3">
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      <button
        onClick={handleAddPurchase}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Purchase
      </button>
    </div>
  );

  // GR Confirmation Modal
  const GRConfirmationModal = () => {
    if (!showGRConfirmation || !selectedPurchase) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-md mx-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-full">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Goods Receipt Confirmation</h3>
                <p className="text-sm text-gray-600">Confirm goods receipt for this purchase</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Purchase Number:</span>
                  <span className="font-medium">{selectedPurchase.purchaseNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span className="font-medium">{selectedPurchase.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">{selectedPurchase.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Supplier:</span>
                  <span className="font-medium">{selectedPurchase.supplier}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Action will be performed:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Add <strong>{selectedPurchase.amount}</strong> units to inventory</li>
                    <li>Mark purchase as <strong>GR Done</strong></li>
                    <li>Update stock levels automatically</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to confirm this goods receipt? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelGR}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmGR}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
              >
                <Package className="w-4 h-4" />
                Confirm GR
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DataTable
        data={currentData}
        columns={columns}
        title="Purchase Orders"
        searchable={true}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          setCurrentPage(1);
        }}
        sortConfig={{ key: null, direction: 'asc' }}
        onSort={(key) => console.log('Sort by:', key)}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        startIndex={startIndex}
        endIndex={Math.min(endIndex, filteredData.length)}
        totalItems={filteredData.length}
        filterComponent={<FilterComponent />}
        actions={<ActionButtons />}
      />

      {/* GR Confirmation Modal */}
      <GRConfirmationModal />
    </div>
  );
};

export default PurchasePage;