"use client";

import { useEffect, useState } from "react";

type Settings = {
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  lateThreshold: string;
  reportEmail: string;
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings));
  }, []);

  function useCurrentLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setS((prev) => prev && { ...prev, officeLat: pos.coords.latitude, officeLng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!s) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl italic mb-1 glow">Settings</h1>
      <p className="text-muted text-sm mb-7">Geofence, late threshold, and report delivery.</p>

      <div className="glass rounded-card p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-ink">Office location</label>
            <button
              onClick={useCurrentLocation}
              disabled={locating}
              className="text-xs text-accent hover:underline"
            >
              {locating ? "Locating…" : "Use my current location"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" step="any"
              value={s.officeLat}
              onChange={(e) => setS({ ...s, officeLat: parseFloat(e.target.value) })}
              placeholder="Latitude"
              className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
            <input
              type="number" step="any"
              value={s.officeLng}
              onChange={(e) => setS({ ...s, officeLng: parseFloat(e.target.value) })}
              placeholder="Longitude"
              className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-muted mt-1.5">Set to your current location for testing — update to the permanent office coordinates before go-live.</p>
        </div>

        <div>
          <label className="block text-sm text-ink mb-2">Geofence radius (meters)</label>
          <input
            type="number"
            value={s.radiusMeters}
            onChange={(e) => setS({ ...s, radiusMeters: parseInt(e.target.value || "0") })}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm w-40"
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-2">Late threshold</label>
          <input
            type="time"
            value={s.lateThreshold}
            onChange={(e) => setS({ ...s, lateThreshold: e.target.value })}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm w-40"
          />
          <p className="text-xs text-muted mt-1.5">Clock-in at or after this time is marked Late.</p>
        </div>

        <div>
          <label className="block text-sm text-ink mb-2">Monthly report recipient</label>
          <input
            type="email"
            value={s.reportEmail}
            onChange={(e) => setS({ ...s, reportEmail: e.target.value })}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm w-72"
          />
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="focus-ring glow-box rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-good text-sm">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
