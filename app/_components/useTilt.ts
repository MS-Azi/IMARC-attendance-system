"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle pointer-driven tilt for a card. Returns a ref to attach to the element
 * (give it the `.tilt` class for the eased transition).
 *
 * Degrades gracefully: does nothing on touch-only devices (no hover / coarse
 * pointer) or when the user prefers reduced motion. Visual only — no state,
 * no effect on behaviour.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 4) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined" || !window.matchMedia) return;

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced) return;

    let frame = 0;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * maxDeg).toFixed(2)}deg) rotateY(${(px * maxDeg).toFixed(2)}deg)`;
      });
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
    };
  }, [maxDeg]);

  return ref;
}
