"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    router.push(data.role === "ADMIN" ? "/admin" : "/clock");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-accent text-xs tracking-[0.2em] uppercase mb-2 glow">iMarcProjects</div>
          <h1 className="font-display text-3xl italic glow">Attendance</h1>
        </div>

        <form
          onSubmit={onSubmit}
          className="glass card-glow-hover rounded-card p-7 space-y-4"
        >
          <div>
            <label className="block text-sm text-muted mb-1.5">Login ID</label>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              type="text"
              autoFocus
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3.5 py-2.5 text-ink placeholder:text-muted"
              placeholder="Phone, email, or admin email"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3.5 py-2.5 text-ink placeholder:text-muted"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-bad text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring glow-box w-full rounded-md bg-accent hover:bg-accentDim transition-colors text-base py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
