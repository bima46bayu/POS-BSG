import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginRequest } from "../api/auth"; // pastikan path ini benar

// ===== BackgroundFader (local component, no export) =====
function BackgroundFader({
  images = [],
  interval = 7000,
  fadeDuration = 1000,
  className = "",
}) {
  const [active, setActive] = useState(0);

  // Preload all images once
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  // Auto-rotate
  useEffect(() => {
    if (!images.length) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  const list = useMemo(() => images.filter(Boolean), [images]);

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`} aria-hidden="true">
      {list.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out ${
            idx === active ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDuration: `${fadeDuration}ms` }}
          draggable="false"
          loading={idx === 0 ? "eager" : "lazy"}
        />
      ))}
      {/* Overlay untuk kontras teks */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-black/40 via-black/20 to-transparent" />
    </div>
  );
}

// ===== Login Page =====
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
      {/* Background: fade antara 3 gambar */}
      <BackgroundFader
        images={[
          "/images/background.jpg",
          "/images/background2.jpg",
          "/images/background3.jpg",
        ]}
        interval={4000}
        fadeDuration={2000}
      />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-lg px-4 py-2 mb-6">
            <img
              src="/images/LogoBSG.png"
              alt="BSG Logo"
              className="h-7 w-auto mr-2 select-none"
              draggable="false"
            />
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
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
      <style>{`
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
