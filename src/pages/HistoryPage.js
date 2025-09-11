import React, { useState } from 'react';
import Table from '../components/table/Table';
// import { TableActions } from '../components/table/TableActions';
import TableActions from '../components/table/TableActions';
import { Eye, Printer } from 'lucide-react';

const HistoryPage = () => {
  // Sample transaction data
  const [transactions] = useState([
    {
      id: 1,
      transactionNumber: 'POS-20250909-0001',
      tanggal: '09 Sep 2025 09:44',
      customer: 'General',
      subTotal: 100000,
      pay: 100000,
      change: 0,
      paymentMethod: 'Cash'
    },
    {
      id: 2,
      transactionNumber: 'POS-20250909-0002', 
      tanggal: '09 Sep 2025 10:15',
      customer: 'General',
      subTotal: 150000,
      pay: 150000,
      change: 0,
      paymentMethod: 'QRIS'
    },
    {
      id: 3,
      transactionNumber: 'POS-20250909-0003',
      tanggal: '09 Sep 2025 11:30', 
      customer: 'General',
      subTotal: 200000,
      pay: 250000,
      change: 50000,
      paymentMethod: 'E-Wallet'
    },
    {
      id: 4,
      transactionNumber: 'POS-20250909-0004',
      tanggal: '09 Sep 2025 14:20',
      customer: 'General', 
      subTotal: 75000,
      pay: 100000,
      change: 25000,
      paymentMethod: 'Card'
    },
    {
      id: 5,
      transactionNumber: 'POS-20250909-0005',
      tanggal: '09 Sep 2025 16:45',
      customer: 'General',
      subTotal: 300000,
      pay: 300000,
      change: 0,
      paymentMethod: 'Transfer'
    }
  ]);

  // Format currency function
  const formatCurrency = (amount) => {
    return `Rp${amount.toLocaleString('id-ID')}`;
  };

  // Action handlers
  const handleViewDetail = (row) => {
    alert(`View detail for transaction: ${row.transactionNumber}`);
    // Implement view detail logic here
  };

  const handlePrintReceipt = (row) => {
    alert(`Print receipt for transaction: ${row.transactionNumber}`);
    // Implement print receipt logic here
  };

  const handleRefund = (row) => {
    const confirm = window.confirm(`Are you sure you want to refund transaction ${row.transactionNumber}?`);
    if (confirm) {
      alert('Refund processed!');
      // Implement refund logic here
    }
  };

  // Column configuration
  const columns = [
    {
      key: 'transactionNumber',
      label: 'Transaction Number',
      sortable: true,
      width: '200px'
    },
    {
      key: 'tanggal', 
      label: 'Tanggal',
      sortable: true,
      width: '160px'
    },
    {
      key: 'customer',
      label: 'Customer', 
      sortable: true,
      width: '100px'
    },
    {
      key: 'subTotal',
      label: 'Sub Total',
      sortable: true,
      align: 'right',
      width: '120px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'pay',
      label: 'Pay',
      sortable: true, 
      align: 'right',
      width: '120px',
      render: (value) => formatCurrency(value)
    },
    {
      key: 'change',
      label: 'Change',
      sortable: true,
      align: 'right', 
      width: '100px',
      render: (value) => value === 0 ? '0' : formatCurrency(value)
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      width: '140px',
      render: (value) => (
        <TableActions 
          status={value}
        />
      )
    },
    {
      key: 'actions',
      label: 'Action',
      width: '200px',
      render: (value, row) => (
        <TableActions
          actions={[
            {
              label: 'Detail',
              icon: <Eye size={16} className="mr-1" />,
              variant: 'primary',
              size: 'md',
              onClick: handleViewDetail,
              className: 'mr-1'
            },
            {
              label: 'Print',
              icon: <Printer size={16} className="mr-1" />,
              variant: 'secondary',
              size: 'md',
              onClick: handlePrintReceipt,
              className: 'mr-1'
            }
            // {
            //   label: 'Refund',
            //   variant: 'danger',
            //   size: 'xs',
            //   onClick: handleRefund
            // }
          ]}
          row={row}
        />
      )
    }
  ];

  const handleSort = (sortConfig) => {
    console.log('Sort by:', sortConfig);
    // Implement sorting logic here
    // You can sort the transactions array based on sortConfig
  };

  const handleSearch = (searchTerm) => {
    console.log('Search:', searchTerm);
    // Implement search logic here
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction History</h1>
        <p className="text-gray-600">View and manage all transaction records</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Transactions</h3>
          <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Sales</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(transactions.reduce((sum, t) => sum + t.subTotal, 0))}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Today's Transactions</h3>
          <p className="text-2xl font-bold text-blue-600">{transactions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Average Sale</h3>
          <p className="text-2xl font-bold text-purple-600">
            {formatCurrency(transactions.reduce((sum, t) => sum + t.subTotal, 0) / transactions.length)}
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search transactions..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="qris">QRIS</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
              <option value="e-wallet">E-Wallet</option>
            </select>
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <Table
          data={transactions}
          columns={columns} 
          sortable={true}
          onSort={handleSort}
          emptyMessage="No transactions found"
          containerClassName="rounded-lg"
        />
      </div>
    </div>
  );
};

export default HistoryPage;