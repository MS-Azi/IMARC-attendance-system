"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Live" },
  { href: "/admin/log", label: "Attendance Log" },
  { href: "/admin/devices", label: "Device Review" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navLinks = (
    <nav className="space-y-1">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`block rounded-md px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
              active
                ? "bg-surface2 text-ink ring-1 ring-inset ring-[rgba(232,56,79,0.4)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const wordmark = (
    <div>
      <div className="font-mono text-accent text-[11px] tracking-[0.24em] uppercase glow">iMarcProjects</div>
      <div className="font-display font-bold uppercase tracking-tight text-lg leading-tight mt-0.5">Attendance</div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border px-5 py-7 flex-col justify-between">
        <div>
          <div className="mb-8 px-1">{wordmark}</div>
          {navLinks}
        </div>
        <button onClick={logout} className="font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-ink text-left px-1">
          Sign out
        </button>
      </aside>

      {/* Mobile: sticky top bar with a hamburger menu */}
      <div className="md:hidden sticky top-0 z-30 glass border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {wordmark}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="focus-ring rounded-md border border-border p-2 text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              {open ? (
                <>
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </>
              ) : (
                <>
                  <path d="M3 6h14" />
                  <path d="M3 10h14" />
                  <path d="M3 14h14" />
                </>
              )}
            </svg>
          </button>
        </div>
        {open && (
          <div className="px-4 pb-4 pt-1 border-t border-border">
            {navLinks}
            <button
              onClick={logout}
              className="mt-2 block w-full text-left rounded-md px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
