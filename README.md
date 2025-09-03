# Point of Sale (PoS) System

A complete Point of Sale desktop application built with Electron and React, featuring comprehensive inventory management, transaction processing, and sales reporting.

## 🚀 Features

### 💳 Point of Sale
- **Product Search**: Quick search by name, category, or barcode
- **Shopping Cart**: Add, remove, and modify quantities
- **Customer Selection**: Assign transactions to customers
- **Payment Processing**: Handle cash payments with change calculation
- **Tax Calculation**: Automatic tax calculation (configurable rate)
- **Real-time Stock Updates**: Inventory automatically updated after sales

### 📦 Product Management (CRUD)
- **Add Products**: Create new products with details
- **Edit Products**: Modify existing product information
- **Delete Products**: Remove products from inventory
- **Product Details**: Name, price, stock, category, barcode
- **Category Management**: Organize products by categories
- **Barcode Support**: Unique barcode for each product

### 📊 Inventory Management
- **Stock Tracking**: Real-time inventory levels
- **Low Stock Alerts**: Visual indicators for low stock items
- **Stock Adjustments**: Manual stock quantity updates
- **Restock Functionality**: Quick restock feature
- **Inventory Filtering**: Filter by stock status (in-stock, low, out-of-stock)
- **Total Inventory Value**: Calculate total value of stock

### 🧾 Transaction History
- **Complete Transaction Log**: All sales transactions recorded
- **Transaction Details**: Detailed view of each transaction
- **Date Filtering**: Filter by today, week, month, or all time
- **Search Functionality**: Search by transaction ID or customer
- **Receipt Information**: Complete receipt details including items, tax, and payment

### 👥 Customer Management
- **Customer Database**: Maintain customer information
- **Customer Profiles**: Name, email, phone number
- **Purchase History**: Track customer purchase patterns
- **Quick Customer Selection**: Fast customer selection during checkout

### 📈 Sales Reports & Analytics
- **Sales Statistics**: Total sales, transaction count, averages
- **Top Products**: Best-selling products analysis
- **Category Performance**: Revenue breakdown by category
- **Date Range Reports**: Flexible date range reporting
- **Visual Analytics**: Easy-to-read charts and statistics

## 🏗️ Technical Features

- **Local Data Storage**: All data stored locally using localStorage
- **Real-time Updates**: Instant updates across all modules
- **Responsive Design**: Works on various screen sizes
- **Desktop Application**: Native desktop experience with Electron
- **Hot Reload**: Development mode with instant code updates
- **Cross-platform**: Works on Windows, Mac, and Linux

## 📋 Sample Data

The application comes pre-loaded with sample data including:
- 4 sample products (Coffee, Sandwich, Water Bottle, Chocolate Bar)
- Default walk-in customer
- Sample categories (Beverages, Food, Snacks)

## 🎯 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm package manager

### Installation

1. **Install dependencies:**
```bash
npm install
```

### Development

1. **Start the development server:**
```bash
npm run electron-dev
```

This will:
- Start the React development server on http://localhost:3000
- Launch the Electron desktop application
- Enable hot reload for React components
- Open developer tools for debugging

### Building for Production

1. **Build the React app:**
```bash
npm run build
```

2. **Package the Electron app:**
```bash
npm run electron-pack
```

The packaged app will be available in the `dist` directory.

## 📱 Usage Guide

### Making a Sale
1. Navigate to **Point of Sale** tab
2. Search for products or browse the product grid
3. Click products to add them to the cart
4. Adjust quantities using +/- buttons
5. Select customer (optional)
6. Click **Checkout**
7. Enter payment amount
8. Complete the sale

### Managing Products
1. Go to **Products** tab
2. Use **+ Add Product** to create new products
3. Click edit (✏️) or delete (🗑️) buttons to modify existing products
4. Use search to find specific products quickly

### Managing Inventory
1. Visit **Inventory** tab
2. View current stock levels for all products
3. Update stock quantities directly in the table
4. Use **Restock** button for quick inventory updates
5. Filter products by stock status

### Viewing Reports
1. Access **Reports** tab
2. Select date range (Today, This Week, This Month, All Time)
3. Review sales statistics and analytics
4. Analyze top-selling products and category performance

## 🏪 Business Use Cases

Perfect for:
- **Retail Stores**: Small to medium retail businesses
- **Coffee Shops**: Cafés and coffee shops
- **Restaurants**: Quick service restaurants
- **Convenience Stores**: Corner shops and convenience stores
- **Pop-up Stores**: Temporary retail locations
- **Market Stalls**: Farmers markets and craft fairs

## 💾 Data Management

- All data is stored locally on the device
- No internet connection required for operation
- Data persists between application restarts
- Easy backup and restore (localStorage files)

## 🔧 Customization

The system can be easily customized:
- **Tax Rates**: Modify tax calculation in utilities
- **Currency**: Change currency symbol and formatting
- **Categories**: Add new product categories
- **Receipt Format**: Customize receipt layout
- **Branding**: Update colors and styling

## 📝 Scripts

- `npm start` - Start React development server only
- `npm run build` - Build React app for production
- `npm run electron` - Run Electron (requires built React app)
- `npm run electron-dev` - Run in development mode with hot reload
- `npm run electron-pack` - Package the app for distribution

## 🔒 Security Features

- **Context Isolation**: Secure communication between processes
- **No Remote Module**: Enhanced security configuration
- **Preload Scripts**: Safe API exposure to renderer process
- **Local Data**: No external data transmission

## 🐛 Troubleshooting

**Application won't start:**
- Ensure all dependencies are installed (`npm install`)
- Check if port 3000 is available
- Try running `npm run build` first

**Data not saving:**
- Check browser localStorage permissions
- Ensure adequate disk space

**Performance issues:**
- Clear old transaction data periodically
- Reduce number of products if experiencing slowdowns

## 🤝 Contributing

This is a complete, production-ready PoS system. Feel free to customize it for your specific business needs or contribute improvements.

## 📄 License

MIT License - Feel free to use this system for commercial purposes.
