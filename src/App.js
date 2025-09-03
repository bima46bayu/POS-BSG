import React, { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Electron + React Desktop App</h1>
        <p>Welcome to your desktop application!</p>
        
        <div className="counter-section">
          <p>Counter: {count}</p>
          <div className="button-group">
            <button 
              onClick={() => setCount(count + 1)}
              className="counter-btn"
            >
              Increment
            </button>
            <button 
              onClick={() => setCount(count - 1)}
              className="counter-btn"
            >
              Decrement
            </button>
            <button 
              onClick={() => setCount(0)}
              className="counter-btn reset"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="info-section">
          <h3>Features</h3>
          <ul>
            <li>✅ Electron main process</li>
            <li>✅ React frontend</li>
            <li>✅ Hot reload in development</li>
            <li>✅ Ready for packaging</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
