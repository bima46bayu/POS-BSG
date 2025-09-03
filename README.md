# Electron React Desktop App

A desktop application built with Electron and React.

## Features

- ⚡ Electron for desktop functionality
- ⚛️ React for the user interface
- 🔄 Hot reload in development
- 📦 Ready for packaging and distribution
- 🔒 Secure communication between processes

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

1. Start the React development server and Electron:
```bash
npm run electron-dev
```

This will:
- Start the React development server on http://localhost:3000
- Launch the Electron app that loads the React app
- Enable hot reload for React components

### Building

1. Build the React app:
```bash
npm run build
```

2. Package the Electron app:
```bash
npm run electron-pack
```

The packaged app will be in the `dist` directory.

## Scripts

- `npm start` - Start React development server only
- `npm run build` - Build React app for production
- `npm run electron` - Run Electron (requires built React app)
- `npm run electron-dev` - Run in development mode with hot reload
- `npm run electron-pack` - Package the app for distribution

## Project Structure

```
├── public/
│   ├── electron.js      # Electron main process
│   ├── preload.js       # Preload script for security
│   └── index.html       # HTML template
├── src/
│   ├── App.js           # Main React component
│   ├── App.css          # App styles
│   ├── index.js         # React entry point
│   └── index.css        # Global styles
└── package.json         # Dependencies and scripts
```

## Security

This app follows Electron security best practices:
- Context isolation enabled
- Node integration disabled in renderer
- Preload script for secure communication

## Customization

- Modify React components in the `src/` directory
- Update Electron configuration in `public/electron.js`
- Add new features using the secure communication pattern in `preload.js`
