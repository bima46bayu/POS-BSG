// src/lib/useAnchoredPopover.js
import { useCallback, useEffect, useState } from "react";

export default function useAnchoredPopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const [anchor, setAnchor] = useState(null);

  const updatePos = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const gap = 8;
    const width = 320;
    const left = Math.min(Math.max(r.left, 8), window.innerWidth - width - 8);
    const top = Math.min(r.bottom + gap, window.innerHeight - 8);
    setPos({ top, left, width });
  }, [anchor]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize, true);
    };
  }, [open, updatePos]);

  return { open, setOpen, pos, setAnchor };
}
