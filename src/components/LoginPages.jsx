import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginRequest } from "../api/auth"; // pastikan path ini benar

const LoginPages = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!email || !password) {
      setError("Email dan password wajib diisi!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // BE mengembalikan { token, user }; loginRequest akan simpan ke localStorage
      await loginRequest(email, password);
      onLogin?.(); // biar App setLoggedIn(true)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login gagal. Periksa email/password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Gradient */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background:
            "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)",
        }}
        aria-hidden="true"
      />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-lg px-4 py-2 mb-6">
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold mr-2">
              BSG
            </div>
            <span className="text-gray-800 font-semibold text-lg">SHITPOS</span>
          </div>
          <p className="text-white text-sm font-medium">
            System for Handling Integrated Transactions – Point of Sale
          </p>
        </div>

        {/* Login Card */}
        <form className="bg-white rounded-2xl shadow-2xl p-8" onSubmit={handleSubmit}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome back!</h2>
            <p className="text-gray-600 text-sm">
              We miss you! Please enter your details.
            </p>
          </div>

          <div className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10 p-1"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-600 text-sm font-medium -mt-2">
                {error}
              </div>
            )}

            {/* Sign In */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>

      {/* CSS for browser compatibility */}
      <style jsx>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
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

export default LoginPages;
