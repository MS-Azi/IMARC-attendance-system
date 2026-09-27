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
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Set false for a blocking modal that can only be closed via an action inside it
   * (e.g. the rules-acknowledgement banner) — disables backdrop-click and Escape. */
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
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
