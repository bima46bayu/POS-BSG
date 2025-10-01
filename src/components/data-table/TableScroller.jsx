// src/components/ui/TableScroller.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Wrapper scroll horizontal untuk table:
 * - Memberi scrollbar tipis
 * - Menampilkan fade/shadow di kiri/kanan saat bisa scroll
 * - Memaksa minWidth tabel supaya scroll muncul saat kolom banyak
 */
export default function TableScroller({
  minWidth = 1100,           // px atau string "72rem"
  className = "",
  children,                  // <thead> + <tbody>
}) {
  const wrapRef = useRef(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [hasRight, setHasRight] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const updateShadow = () => {
      setHasLeft(el.scrollLeft > 0);
      setHasRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    updateShadow();
    el.addEventListener("scroll", updateShadow, { passive: true });
    const ro = new ResizeObserver(updateShadow);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateShadow);
      ro.disconnect();
    };
  }, []);

  const minW = typeof minWidth === "number" ? `${minWidth}px` : String(minWidth);

  return (
    <div
      ref={wrapRef}
      className={`custom-hscroll ${hasLeft ? "has-left" : ""} ${hasRight ? "has-right" : ""} ${className}`}
    >
      <table className="min-w-full text-sm" style={{ minWidth: minW }}>
        {children}
      </table>
    </div>
  );
}
