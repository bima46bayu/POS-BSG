import React, { useState } from 'react';
import { DataTable } from '../components/data-table';
import { useTable } from '../hooks/useTable';
import { Calendar, Download, Filter, X } from 'lucide-react';

const HistoryPage = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Sample data sesuai dengan gambar
  const sampleData = [
    {
      transactionNumber: 'POS-20250909-0001',
      tanggal: '09 Sep 2025 09:44',
      customer: 'General',
      subTotal: 'Rp100.000',
      pay: 'Rp100.000',
      change: '0',
      paymentMethod: 'Cash',
    },
    {
      transactionNumber: 'POS-20250909-0002',
      tanggal: '09 Sep 2025 10:15',
      customer: 'General',
      subTotal: 'Rp150.000',
      pay: 'Rp150.000',
      change: '0',
      paymentMethod: 'QRIS',
    },
    {
      transactionNumber: 'POS-20250909-0003',
      tanggal: '09 Sep 2025 11:30',
      customer: 'General',
      subTotal: 'Rp75.000',
      pay: 'Rp75.000',
      change: '0',
      paymentMethod: 'E-Wallet',
    },
    {
      transactionNumber: 'POS-20250909-0004',
      tanggal: '09 Sep 2025 12:45',
      customer: 'General',
      subTotal: 'Rp200.000',
      pay: 'Rp200.000',
      change: '0',
      paymentMethod: 'Card',
    },
    {
      transactionNumber: 'POS-20250909-0005',
      tanggal: '09 Sep 2025 13:20',
      customer: 'General',
      subTotal: 'Rp120.000',
      pay: 'Rp120.000',
      change: '0',
      paymentMethod: 'Transfer',
    },
    // Tambahkan lebih banyak data untuk testing pagination
    ...Array.from({ length: 20 }, (_, i) => ({
      transactionNumber: `POS-20250909-${String(i + 6).padStart(4, '0')}`,
      tanggal: '09 Sep 2025 14:00',
      customer: 'General',
      subTotal: 'Rp100.000',
      pay: 'Rp100.000',
      change: '0',
      paymentMethod: i % 2 === 0 ? 'Cash' : 'QRIS',
    }))
  ];

  const {
    data: tableData,
    currentPage,
    totalPages,
    setCurrentPage,
    searchTerm,
    handleSearch,
    sortConfig,
    handleSort,
    filters,
    handleFilter,
    resetFilters,
    startIndex,
    endIndex,
    totalItems
  } = useTable(sampleData, {
    itemsPerPage: 10,
    searchFields: ['transactionNumber', 'customer', 'paymentMethod']
  });

  const columns = [
    {
      key: 'transactionNumber',
      label: 'Transaction Number',
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
      key: 'customer',
      label: 'Customer',
      sortable: true,
      minWidth: '120px'
    },
    {
      key: 'subTotal',
      label: 'Sub Total',
      align: 'right',
      minWidth: '120px',
      className: 'font-medium text-gray-900',
      sortable: true
    },
    {
      key: 'pay',
      label: 'Pay',
      align: 'right',
      minWidth: '120px',
      className: 'font-medium text-gray-900',
      sortable: true
    },
    {
      key: 'change',
      label: 'Change',
      align: 'right',
      minWidth: '100px'
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      minWidth: '140px',
      render: (value) => {
        const getPaymentMethodStyle = (method) => {
          const styles = {
            'Cash': 'bg-green-100 text-green-800 border-green-200',
            'QRIS': 'bg-orange-100 text-orange-800 border-orange-200',
            'E-Wallet': 'bg-purple-100 text-purple-800 border-purple-200',
            'Card': 'bg-blue-100 text-blue-800 border-blue-200',
            'Transfer': 'bg-yellow-100 text-yellow-800 border-yellow-200',
          };
          return styles[method] || 'bg-gray-100 text-gray-800 border-gray-200';
        };

        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPaymentMethodStyle(value)}`}>
            {value}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Action',
      sticky: 'right',
      align: 'center',
      minWidth: '120px',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrintStruk(row)}
            className="inline-flex items-center px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            Print Struk
          </button>
        </div>
      )
    }
  ];

  const handlePrintStruk = (row) => {
    console.log('Print struk for:', row.transactionNumber);
  };

  const handleExport = () => {
    // Implementasi export data
    console.log('Export data');
  };

  const FilterComponent = () => (
    <div className="relative">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <Filter className="w-4 h-4" />
        Filter
        {Object.keys(filters).length > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
            {Object.keys(filters).length}
          </span>
        )}
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
                  Payment Method
                </label>
                <select
                  value={filters.paymentMethod || ''}
                  onChange={(e) => handleFilter('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="E-Wallet">E-Wallet</option>
                  <option value="Card">Card</option>
                  <option value="Transfer">Transfer</option>
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
                onClick={resetFilters}
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

  const ActionButtons = () => (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
    >
      <Download className="w-4 h-4" />
      Export
    </button>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DataTable
        data={tableData}
        columns={columns}
        title="Transaction History"
        searchable={true}
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        sortConfig={sortConfig}
        onSort={handleSort}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
        filterComponent={<FilterComponent />}
        actions={<ActionButtons />}
      />
    </div>
  );
};

export default HistoryPage;