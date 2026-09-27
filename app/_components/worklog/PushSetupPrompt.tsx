"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "imarc_push_dismissed_date";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export default function PushSetupPrompt() {
  const [visible, setVisible] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        setSubscribed(true);
        return;
      }
      let dismissed: string | null = null;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY);
      } catch {}
      const today = new Date().toISOString().slice(0, 10);
      if (dismissed !== today) setVisible(true);
    });
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    } catch {}
    setVisible(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setBusy(false);
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push isn't configured yet.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
      });
      setSubscribed(true);
      setVisible(false);
    } catch {
      // fail open — push is a nice-to-have, never block the rest of the app
    }
    setBusy(false);
  }

  if (!visible || subscribed) return null;

  const iosNotStandalone = isIos() && !isStandalone();

  return (
    <div className="glass rounded-card p-4 w-full max-w-sm mt-6 text-sm">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-2">Get reminders</p>
      {iosNotStandalone ? (
        <p className="font-mono text-xs text-muted mb-3">
          On iPhone, tap Share → "Add to Home Screen", then open the app from there to enable reminders (needs iOS 16.4+).
        </p>
      ) : (
        <p className="font-mono text-xs text-muted mb-3">Turn on push notifications so you don't miss an update slot.</p>
      )}
      <div className="flex items-center gap-4">
        {!iosNotStandalone && (
          <button
            onClick={enable}
            disabled={busy}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
        )}
        <button onClick={dismiss} className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
          Not now
        </button>
      </div>
    </div>
  );
}
