import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import POSPage from '../pages/POSPage';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (email && password) {
      setError('');
      console.log('Login attempt:', { email, password });
      if (onLogin) onLogin();
    } else {
      setError('Email dan password wajib diisi!');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

//   if (loggedIn) {
//     return <POSPage />;
//   }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)'
        }}
      />
      
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="inline-flex items-center justify-center bg-white rounded-lg px-4 py-2 mb-6">
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold mr-2">
              BSG
            </div>
            <span className="text-gray-800 font-semibold text-lg">SHITPOS</span>
          </div>
          
          {/* Subtitle */}
          <p className="text-white text-sm font-medium">
            System for Handling Integrated Transactions – Point of Sale
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome back!</h2>
            <p className="text-gray-600 text-sm">We miss you! Please enter your details.</p>
          </div>

          <div className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    WebkitTextSecurity: showPassword ? 'none' : 'disc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10 p-1"
                  tabIndex={-1}
                  style={{ pointerEvents: 'auto' }}
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>
                        {/* Error Message */}
            {error && (
              <div className="text-red-600 text-sm font-medium mt-2 mb-2 text-left">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* CSS for browser compatibility */}
      <style jsx>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none !important;
        }
        
        input[type="password"]::-webkit-contacts-auto-fill-button,
        input[type="password"]::-webkit-credentials-auto-fill-button {
          display: none !important;
        }
        
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;