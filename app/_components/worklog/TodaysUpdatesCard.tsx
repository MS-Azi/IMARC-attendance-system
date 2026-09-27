"use client";

import { useEffect, useState } from "react";
import CornerBrackets from "@/app/_components/CornerBrackets";
import Modal from "@/app/_components/Modal";
import { useToast } from "@/app/_components/ToastProvider";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/worklog/whatsapp";
import { fmtTime } from "@/lib/worklog/format";

type Slot = {
  id: string;
  slotIndex: number;
  label: string;
  opensAt: string;
  onTimeClosesAt: string;
  lateClosesAt: string;
  status: "UPCOMING" | "OPEN_ON_TIME" | "OPEN_LATE" | "MISSED" | "ON_TIME" | "LATE" | "EXCUSED";
  note: string | null;
  link: string | null;
  tickedAt: string | null;
};

type WhatsApp = { whatsappMode: "DIRECT" | "GROUP"; adminWhatsappNumber: string | null } | null;

const STATUS_LABEL: Record<Slot["status"], string> = {
  UPCOMING: "Upcoming",
  OPEN_ON_TIME: "Open now",
  OPEN_LATE: "Open (late)",
  MISSED: "Missed",
  ON_TIME: "Submitted on time",
  LATE: "Submitted late",
  EXCUSED: "Excused",
};

// MISSED deliberately uses a more muted red than the bright accent red used for
// actionable/open items, so the card doesn't read as universally alarming.
const STATUS_COLOR: Record<Slot["status"], string> = {
  UPCOMING: "text-muted",
  OPEN_ON_TIME: "text-accent",
  OPEN_LATE: "text-late",
  MISSED: "text-bad/60",
  ON_TIME: "text-good",
  LATE: "text-late",
  EXCUSED: "text-muted",
};

export default function TodaysUpdatesCard() {
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsApp>(null);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/worklog/today");
    const data = await res.json();
    setSlots(data.slots);
    setWhatsapp(data.whatsapp);
    setStaffFirstName(data.staffFirstName || "");
    setLoading(false);
  }

  function openSlot(slot: Slot) {
    if (slot.status !== "OPEN_ON_TIME" && slot.status !== "OPEN_LATE") return;
    setActive(slot);
    setNote("");
    setLink("");
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setFormError(null);
    if (note.trim().length < 10 || note.trim().length > 280) {
      setFormError("Note must be 10-280 characters.");
      return;
    }
    if (link.trim()) {
      try {
        new URL(link.trim());
      } catch {
        setFormError("Link must be a valid URL.");
        return;
      }
    }
    setSubmitting(true);
    const res = await fetch(`/api/worklog/slots/${active.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim(), link: link.trim() || undefined }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setFormError(data.error);
      return;
    }

    const late = data.record.outcome === "LATE";
    toast(late ? "Submitted late. This counts as a late submission." : "Submitted on time.", late ? "warning" : "ok");
    setActive(null);
    load();

    if (whatsapp) {
      const message = buildWhatsAppMessage(data.slotLabel, staffFirstName, note.trim(), link.trim() || null);
      const url = buildWhatsAppUrl(whatsapp, message);
      window.open(url, "_blank");
    }
  }

  if (loading) return null;
  if (!slots || slots.length === 0) return null; // not a working day, or no rules published yet

  return (
    <>
      <div className="tilt glass card-glow-hover relative rounded-card p-6 w-full max-w-sm space-y-4 mt-6">
        <CornerBrackets />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Today's Updates</p>
        <div className="space-y-2.5">
          {slots.map((s) => {
            const tappable = s.status === "OPEN_ON_TIME" || s.status === "OPEN_LATE";

            if (tappable) {
              return (
                <button
                  key={s.id}
                  onClick={() => openSlot(s)}
                  className="focus-ring glow-box w-full flex items-center justify-between rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-3 text-left text-white"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{s.label}</p>
                    <p className="font-mono text-[10px] opacity-80 mt-0.5">
                      {s.status === "OPEN_ON_TIME" ? `on time until ${fmtTime(s.onTimeClosesAt)}` : `closes at ${fmtTime(s.lateClosesAt)}`}
                    </p>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-[0.1em] whitespace-nowrap">Submit →</span>
                </button>
              );
            }

            return (
              <div key={s.id} className="w-full">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{s.label}</span>
                  <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                {s.status === "UPCOMING" && <p className="font-mono text-[10px] text-muted mt-0.5">opens {fmtTime(s.opensAt)}</p>}
                {(s.status === "ON_TIME" || s.status === "LATE") && s.note && (
                  <p className="font-mono text-[10px] text-muted mt-0.5 truncate">"{s.note}"</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={!!active} onClose={() => setActive(null)} title={active ? `${active.label} Update` : ""}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">
              What did you send? ({note.length}/280)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={3}
              placeholder="e.g. Sent revised floor plans for Pearl to the admin"
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Link (optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <p className="font-mono text-[11px] text-muted">After you submit, WhatsApp opens so you can attach your work.</p>
          {active?.status === "OPEN_LATE" && (
            <p className="font-mono text-late text-[11px]">This window is past the on-time cutoff — submitting now counts as late.</p>
          )}
          {formError && <p className="font-mono text-bad text-xs">{formError}</p>}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring glow-box flex-1 rounded-md bg-accent hover:bg-accentDim transition-colors py-3 font-mono text-xs uppercase tracking-[0.2em] font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
