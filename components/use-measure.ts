"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks an element's pixel width so SVG can be drawn at 1:1 instead of being
 * scaled by a viewBox — which would shrink axis labels into illegibility on
 * narrow screens.
 */
export function useMeasure<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = (next: number) =>
      setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));

    sync(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      sync(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);

    // Belt and braces: some resize paths (device rotation, a window resized by
    // the OS rather than the user) have been known not to deliver an observer
    // entry. A stale width here would overflow the page, so re-read on resize.
    const onResize = () => sync(el.clientWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return [ref, width];
}
