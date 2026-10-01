"use client";

import { useState } from "react";

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function download() {
    setDownloading(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Backup failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `imarc-backup-${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1 glow">Data Backup</h1>
      <p className="font-mono text-muted text-[11px] uppercase tracking-[0.16em] leading-relaxed mb-7">
        Supabase's free tier keeps no backups — download and keep a copy yourself.
      </p>

      <div className="glass rounded-card p-5 max-w-lg">
        <button
          onClick={download}
          disabled={downloading}
          className="focus-ring glow-box rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white disabled:opacity-60"
        >
          {downloading ? "Generating…" : "Download full backup"}
        </button>
        <p className="font-mono text-[11px] text-muted mt-3 leading-relaxed">
          One .zip with an Excel workbook (one sheet per table) and a complete JSON file per table, for restoring
          later if ever needed.
        </p>
        {done && <p className="font-mono text-good text-xs mt-2">Backup downloaded.</p>}
        {error && <p className="font-mono text-bad text-xs mt-2">{error}</p>}
      </div>

      <p className="font-mono text-late text-[11px] mt-5 max-w-lg leading-relaxed">
        This file contains salaries and personal data. Store it somewhere private, such as a restricted Google Drive
        folder.
      </p>
    </div>
  );
}
