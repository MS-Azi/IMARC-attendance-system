"use client";

import { useEffect } from "react";
import CornerBrackets from "./CornerBrackets";

/**
 * A generic modal/sheet built from the app's existing `.glass` card style —
 * no new visual language, just a reusable overlay wrapper.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass relative rounded-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <CornerBrackets />
        {title && (
          <h2 className="font-display text-lg font-bold uppercase tracking-tight mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
