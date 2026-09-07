"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Live" },
  { href: "/admin/log", label: "Attendance Log" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border px-5 py-7 flex flex-col justify-between">
      <div>
        <div className="mb-8 px-1">
          <div className="text-accent text-xs tracking-wide">iMarcProjects</div>
          <div className="font-display italic text-lg mt-0.5">Attendance</div>
        </div>
        <nav className="space-y-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-surface2 text-ink border border-border" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button onClick={logout} className="text-sm text-muted hover:text-ink text-left px-1">
        Sign out
      </button>
    </aside>
  );
}
