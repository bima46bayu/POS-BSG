import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import {
  Home, CreditCard, Package, Archive, ShoppingCart, Clock, LogOut, Menu, X, PackageCheck,
  FolderTree, ChevronDown, User, Folder, GitBranch, Truck, MapPin,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/* Utils */
const toAbs = (p) => (p?.startsWith("/") ? p : `/${String(p || "").replace(/^\/+/, "")}`);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const POPOVER_WIDTH = 240; // w-60
const SAFE_MARGIN = 8;

export default function Sidebar({
  currentPage,
  onNavigate,
  userRole,
  onLogout,
  allowedPages = [],
  logoSrc = "/images/LogoBSG.png",
}) {
  const location = useLocation();

  // ====== STATE ======
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [masterOpenMobile, setMasterOpenMobile] = useState(false);

  // popover states
  const [hoverOpen, setHoverOpen] = useState(false);         // desktop hover
  const [clickOpen, setClickOpen] = useState(false);         // tap/click toggle
  const isOpen = hoverOpen || clickOpen;

  const [popoverStyle, setPopoverStyle] = useState({ top: 80, left: 96 });
  const [popoverMaxH, setPopoverMaxH] = useState(320);

  // ====== robust canHover detection (live) ======
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    const mHover = window.matchMedia("(hover: hover)");
    const mPointerFine = window.matchMedia("(pointer: fine)");
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return mHover.matches && mPointerFine.matches && !hasTouch;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mHover = window.matchMedia("(hover: hover)");
    const mPointerFine = window.matchMedia("(pointer: fine)");
    const update = () => {
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setCanHover(mHover.matches && mPointerFine.matches && !hasTouch);
    };
    mHover.addEventListener?.("change", update);
    mPointerFine.addEventListener?.("change", update);
    update();
    return () => {
      mHover.removeEventListener?.("change", update);
      mPointerFine.removeEventListener?.("change", update);
    };
  }, []);

  const logoSrcAbs = useMemo(() => toAbs(logoSrc), [logoSrc]);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const raf = useRef(null);

  // ====== LIFECYCLE ======
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
      positionPopover();
    };
    const onScroll = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(positionPopover);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  // outside click (untuk mode click/tap)
  useEffect(() => {
    function onDocClick(e) {
      if (!isOpen) return;
      if (!popoverRef.current || !triggerRef.current) return;
      if (popoverRef.current.contains(e.target) || triggerRef.current.contains(e.target)) return;
      setClickOpen(false);
      setHoverOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [isOpen]);

  // auto open accordion on /master/*
  useEffect(() => {
    const p = location.pathname || "";
    if (p.startsWith("/master/")) setMasterOpenMobile(true);
  }, [location.pathname]);

  useLayoutEffect(() => {
    positionPopover();
  }, [isOpen, location.pathname]);

  // ====== DATA ======
  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "pos", label: "POS", icon: CreditCard },
    { id: "products", label: "Product", icon: Package },
    { id: "inventory", label: "Inventory", icon: Archive },
    { id: "purchase", label: "Purchase", icon: ShoppingCart },
    { id: "gr", label: "GR", icon: PackageCheck },
    { id: "history", label: "History", icon: Clock },
  ];

  const masterItems = [
    { label: "User",           path: "/master/user",           icon: User },
    { label: "Category",       path: "/master/category",       icon: Folder },
    { label: "Sub-Category",   path: "/master/sub-category",   icon: GitBranch },
    { label: "Supplier",       path: "/master/supplier",       icon: Truck },
    { label: "Store Location", path: "/master/store-location", icon: MapPin },
  ];

  const allowedList = allowedPages?.length ? allowedPages : menuItems.map((i) => i.id);
  const allowedSet = useMemo(() => new Set(allowedList), [allowedList]);
  const visibleItems = useMemo(() => menuItems.filter((i) => allowedSet.has(i.id)), [menuItems, allowedSet]);
  const showMaster = allowedSet.has("master");

  // ====== HELPERS ======
  const handleNavigate = (pageId) => {
    if (allowedSet.has(pageId)) {
      onNavigate?.(pageId);
      setIsMobileMenuOpen(false);
    }
  };
  const handleLogout = () => {
    onLogout?.();
    setIsMobileMenuOpen(false);
  };

  const isMasterGroupActive = () => (location.pathname || "").startsWith("/master/");
  const isMasterItemActive = (path) => (location.pathname || "") === path;

  function positionPopover() {
    const trg = triggerRef.current;
    if (!trg) return;
    const rect = trg.getBoundingClientRect();

    let left = rect.right + SAFE_MARGIN;
    left = clamp(left, SAFE_MARGIN, window.innerWidth - POPOVER_WIDTH - SAFE_MARGIN);

    const panelH = popoverRef.current?.getBoundingClientRect().height || 240;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - SAFE_MARGIN;
    const spaceAbove = rect.top - SAFE_MARGIN;

    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    let top = openUp ? rect.bottom - panelH : rect.top;
    top = clamp(top, SAFE_MARGIN, vh - SAFE_MARGIN - panelH);

    setPopoverMaxH(vh - SAFE_MARGIN * 2);
    setPopoverStyle({ top, left });
  }

  // ====== HOVER-INTENT (desktop only) ======
  const HOVER_OPEN_DELAY = 60;
  const HOVER_CLOSE_DELAY = 150;

  const openByHover = () => {
    if (!canHover) return;
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      setHoverOpen(true);
      positionPopover();
    }, HOVER_OPEN_DELAY);
  };
  const closeByHover = () => {
    if (!canHover) return;
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoverOpen(false), HOVER_CLOSE_DELAY);
  };

  return (
    <>
      {/* Mobile Hamburger */}
      <button
        onClick={() => setIsMobileMenuOpen((v) => !v)}
        className={`md:hidden fixed top-4 left-4 z-[60] p-3 bg-white rounded-xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 ${isMobileMenuOpen ? "bg-gray-100" : ""}`}
        aria-label="Toggle menu"
      >
        <Menu size={22} className="text-gray-700" />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-24 bg-white shadow-lg flex-col py-6 border-r border-gray-200 h-screen fixed top-0 left-0 z-40">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <Link to="/" aria-label="Go to home">
            <img
              src={logoSrcAbs}
              alt="Logo"
              loading="lazy"
              className="w-12 h-12 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.outerHTML =
                  `<div class='w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                     <div class='bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-bold'>BSG</div>
                   </div>`;
              }}
            />
          </Link>
        </div>

        {/* Nav (scrollable) */}
        <nav className="flex-1 w-full px-0 overflow-y-auto pr-1 pb-16">
          <div className="flex flex-col items-center space-y-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`relative flex flex-col items-center justify-center px-2 h-14 rounded-xl transition-all duration-200 ${
                    isActive ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r" />
                  )}
                  <Icon size={24} className="mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}

            {/* MASTER trigger */}
            {showMaster && (
              <div className="w-full px-3 relative">
                <div
                  ref={triggerRef}
                  onClick={() => {
                    // tap/click toggle (berlaku di semua device)
                    setClickOpen((v) => !v);
                    positionPopover();
                  }}
                  onMouseEnter={openByHover}
                  onMouseLeave={closeByHover}
                  className={`relative w-full flex flex-col items-center justify-center h-14 rounded-xl transition-all duration-200 cursor-pointer ${
                    isMasterGroupActive() ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-expanded={isOpen}
                >
                  {isMasterGroupActive() && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r" />
                  )}
                  <FolderTree size={24} className="mb-1" />
                  <span className="text-xs font-medium">Master</span>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Logout */}
        <div className="mt-auto pt-2">
          <button
            onClick={handleLogout}
            className="w-full flex flex-col items-center justify-center px-2 h-14 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut size={24} className="mb-1" />
            <span className="text-xs font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Floating dropdown (desktop & click on touch) */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popoverStyle.top, left: popoverStyle.left, maxHeight: popoverMaxH, width: POPOVER_WIDTH }}
          className="pointer-events-auto overflow-auto rounded-xl border border-gray-200 bg-white shadow-2xl z-[55]"
          role="menu"
          onMouseEnter={openByHover}
          onMouseLeave={closeByHover}
        >
          <div className="py-2">
            {[
              { label: "User",           path: "/master/user",           icon: User },
              { label: "Category",       path: "/master/category",       icon: Folder },
              { label: "Sub-Category",   path: "/master/sub-category",   icon: GitBranch },
              { label: "Supplier",       path: "/master/supplier",       icon: Truck },
              { label: "Store Location", path: "/master/store-location", icon: MapPin },
            ].map((mi) => {
              const active = isMasterItemActive(mi.path);
              const Icon = mi.icon;
              return (
                <Link
                  key={mi.path}
                  to={mi.path}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg mx-2 ${active ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"}`}
                  onClick={() => { setClickOpen(false); setHoverOpen(false); }}
                  role="menuitem"
                >
                  <Icon size={16} className="shrink-0 opacity-80" />
                  <span>{mi.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      <div className="md:hidden">
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        <div
          className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } flex flex-col`}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
                <img
                  src={logoSrcAbs}
                  alt="Logo"
                  loading="lazy"
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.currentTarget.outerHTML =
                      `<div class='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                         <div class='bg-blue-600 text-white px-1 py-0.5 rounded text-xs font-bold'>BSG</div>
                       </div>`;
                  }}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">POS System</h2>
                <p className="text-sm text-gray-500">SHITPOS</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X size={22} className="text-gray-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <nav className="flex-1 p-4 overflow-y-auto pb-24">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl transition-all duration-200 mb-2 ${
                    isActive
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={22} />
                  <span className="font-medium text-base">{item.label}</span>
                </button>
              );
            })}

            {/* MASTER accordion (mobile) */}
            {allowedSet.has("master") && (
              <div className="mt-2">
                <button
                  onClick={() => setMasterOpenMobile((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all duration-200 mb-2 ${
                    (location.pathname || "").startsWith("/master/")
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  aria-expanded={masterOpenMobile}
                >
                  <span className="flex items-center gap-3">
                    <FolderTree size={22} />
                    <span className="font-medium text-base">Master</span>
                  </span>
                  <ChevronDown size={18} className={`transition-transform ${masterOpenMobile ? "rotate-180" : ""}`} />
                </button>

                <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${masterOpenMobile ? "max-h-96" : "max-h-0"}`}>
                  <ul className="pl-2">
                    {[
                      { label: "User", path: "/master/user", icon: User },
                      { label: "Category", path: "/master/category", icon: Folder },
                      { label: "Sub-Category", path: "/master/sub-category", icon: GitBranch },
                      { label: "Supplier", path: "/master/supplier", icon: Truck },
                      { label: "Store Location", path: "/master/store-location", icon: MapPin },
                    ].map((mi) => {
                      const active = isMasterItemActive(mi.path);
                      const Icon = mi.icon;
                      return (
                        <li key={mi.path} className="mb-1">
                          <Link
                            to={mi.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm ${
                              active ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                          >
                            <Icon size={16} className="shrink-0 opacity-80" />
                            <span>{mi.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </nav>

          {/* Footer sticky */}
          <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-4 px-4 py-4 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={22} />
              <span className="font-medium text-base">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
