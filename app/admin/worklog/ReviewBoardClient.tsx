"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/_components/Modal";
import { useToast } from "@/app/_components/ToastProvider";
import { fmtTime } from "@/lib/worklog/format";

type Slot = {
  id: string;
  slotIndex: number;
  label: string;
  status: string;
  reviewStatus: "VALID" | "FALSE" | "EXCUSED";
  reviewReason: string | null;
  note: string | null;
  link: string | null;
  tickedAt: string | null;
};
type Row = {
  staffId: string;
  staffName: string;
  department: string | null;
  clockIn: string | null;
  clockInStatus: string | null;
  clockInExcused: boolean;
  attendanceId: string | null;
  slots: Slot[];
};
type Board = { rows: Row[]; summary: { total: number; onTime: number; late: number; missed: number } };

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: "text-muted",
  OPEN_ON_TIME: "text-accent",
  OPEN_LATE: "text-late",
  MISSED: "text-bad/60",
  ON_TIME: "text-good",
  LATE: "text-late",
  EXCUSED: "text-muted",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
const fmt = fmtTime;

export default function ReviewBoardClient() {
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [exceptionsOnly, setExceptionsOnly] = useState(false);

  const [activeSlot, setActiveSlot] = useState<{ row: Row; slot: Slot } | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [bulk, setBulk] = useState({ staffId: "", from: "", to: "", reason: "" });
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/worklog/review?date=${date}`);
    const data = await res.json();
    setBoard(data.rows ? data : null);
    setLoading(false);
  }

  const maxSlots = useMemo(() => Math.max(0, ...(board?.rows.map((r) => r.slots.length) ?? [0])), [board]);
  const slotLabels = useMemo(() => {
    if (!board) return [];
    const row = board.rows.find((r) => r.slots.length === maxSlots);
    return row ? row.slots.map((s) => s.label) : [];
  }, [board, maxSlots]);

  const visibleRows = useMemo(() => {
    if (!board) return [];
    if (!exceptionsOnly) return board.rows;
    return board.rows.filter(
      (r) =>
        (r.clockInStatus === "LATE" && !r.clockInExcused) ||
        r.slots.some((s) => (s.status === "LATE" || s.status === "MISSED") && s.reviewStatus === "VALID")
    );
  }, [board, exceptionsOnly]);

  function openSlot(row: Row, slot: Slot) {
    setActiveSlot({ row, slot });
    setReason("");
  }

  async function reviewSlot(action: "FALSE" | "EXCUSE" | "UNDO") {
    if (!activeSlot) return;
    if (action === "EXCUSE" && !reason.trim()) {
      toast("A reason is required to excuse.", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/worklog/slots/${activeSlot.slot.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason.trim() || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast(action === "UNDO" ? "Review undone." : action === "FALSE" ? "Marked false." : "Excused.");
    setActiveSlot(null);
    load();
  }

  async function excuseAttendance() {
    if (!activeAttendance?.attendanceId) return;
    if (!reason.trim()) {
      toast("A reason is required to excuse.", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/attendance/${activeAttendance.attendanceId}/excuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      toast((await res.json()).error, "error");
      return;
    }
    toast("Late clock-in excused.");
    setActiveAttendance(null);
    load();
  }

  async function undoAttendanceExcuse() {
    if (!activeAttendance?.attendanceId) return;
    setBusy(true);
    await fetch(`/api/admin/attendance/${activeAttendance.attendanceId}/excuse`, { method: "DELETE" });
    setBusy(false);
    toast("Excuse undone.");
    setActiveAttendance(null);
    load();
  }

  async function submitBulkExcuse(e: React.FormEvent) {
    e.preventDefault();
    if (!bulk.staffId || !bulk.from || !bulk.to || !bulk.reason.trim()) {
      toast("Staff, date range, and reason are all required.", "error");
      return;
    }
    setBulkBusy(true);
    const res = await fetch(`/api/admin/worklog/staff/${bulk.staffId}/excuse-range`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bulk),
    });
    const data = await res.json();
    setBulkBusy(false);
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast(`Excused ${data.days.length} day(s).`);
    setBulk({ staffId: "", from: "", to: "", reason: "" });
    load();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1">Daily Review</h1>
          {board && (
            <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">
              {board.summary.onTime} on time · {board.summary.late} late · {board.summary.missed} missed of {board.summary.total}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="focus-ring rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            <input type="checkbox" checked={exceptionsOnly} onChange={(e) => setExceptionsOnly(e.target.checked)} />
            Exceptions only
          </label>
        </div>
      </div>

      <div className="relative mb-8">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Staff</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Clock In</th>
                {slotLabels.map((label, i) => (
                  <th key={i} className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={2 + slotLabels.length} className="px-3 py-8 md:px-5 text-center text-muted">
                    {board ? "Nothing to show." : "No rules published for this date."}
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <tr key={row.staffId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{row.staffName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">
                    <button
                      onClick={() => {
                        if (row.clockInStatus === "LATE") {
                          setActiveAttendance(row);
                          setReason("");
                        }
                      }}
                      className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
                        row.clockInExcused ? "text-muted" : row.clockInStatus === "LATE" ? "text-late hover:underline" : "text-good"
                      }`}
                    >
                      {fmt(row.clockIn)}
                      {row.clockInExcused ? " (excused)" : row.clockInStatus === "LATE" ? " (late)" : ""}
                    </button>
                  </td>
                  {Array.from({ length: slotLabels.length }).map((_, i) => {
                    const slot = row.slots[i];
                    if (!slot) return <td key={i} className="px-3 py-2.5 md:px-5 md:py-3 text-muted">—</td>;
                    return (
                      <td key={i} className="px-3 py-2.5 md:px-5 md:py-3">
                        <button
                          onClick={() => openSlot(row, slot)}
                          className={`font-mono text-[11px] uppercase tracking-[0.1em] hover:underline ${
                            slot.reviewStatus === "FALSE" ? "text-bad" : slot.reviewStatus === "EXCUSED" ? "text-muted" : STATUS_COLOR[slot.status]
                          }`}
                        >
                          {slot.reviewStatus === "FALSE" ? "FALSE" : slot.status.replace(/_/g, " ")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-card p-4 md:p-6 max-w-xl">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink mb-4">Excuse a date range (leave)</h2>
        <form onSubmit={submitBulkExcuse} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Staff</label>
            <select
              value={bulk.staffId}
              onChange={(e) => setBulk({ ...bulk, staffId: e.target.value })}
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {board?.rows.map((r) => (
                <option key={r.staffId} value={r.staffId}>
                  {r.staffName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">From</label>
            <input
              type="date"
              value={bulk.from}
              onChange={(e) => setBulk({ ...bulk, from: e.target.value })}
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">To</label>
            <input
              type="date"
              value={bulk.to}
              onChange={(e) => setBulk({ ...bulk, to: e.target.value })}
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Reason</label>
            <input
              value={bulk.reason}
              onChange={(e) => setBulk({ ...bulk, reason: e.target.value })}
              placeholder="e.g. Approved annual leave"
              className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={bulkBusy}
            className="sm:col-span-2 focus-ring rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white disabled:opacity-60"
          >
            {bulkBusy ? "Excusing…" : "Excuse range"}
          </button>
        </form>
      </div>

      <Modal
        open={!!activeSlot}
        onClose={() => setActiveSlot(null)}
        title={activeSlot ? `${activeSlot.row.staffName} — ${activeSlot.slot.label}` : ""}
      >
        {activeSlot && (
          <div className="space-y-3">
            <p className="font-mono text-[11px] text-muted">
              Status: <span className={STATUS_COLOR[activeSlot.slot.status]}>{activeSlot.slot.status.replace(/_/g, " ")}</span>
              {activeSlot.slot.tickedAt && <> · ticked {fmt(activeSlot.slot.tickedAt)}</>}
            </p>
            {activeSlot.slot.note && <p className="font-mono text-sm">"{activeSlot.slot.note}"</p>}
            {activeSlot.slot.link && (
              <a href={activeSlot.slot.link} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline break-all">
                {activeSlot.slot.link}
              </a>
            )}
            <p className="font-mono text-[11px] text-muted">
              WhatsApp tag: [{activeSlot.slot.label} UPDATE] {activeSlot.row.staffName.split(" ")[0]}
            </p>
            {activeSlot.slot.reviewStatus !== "VALID" && (
              <p className="font-mono text-[11px] text-late">
                Currently: {activeSlot.slot.reviewStatus}
                {activeSlot.slot.reviewReason ? ` — ${activeSlot.slot.reviewReason}` : ""}
              </p>
            )}

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Reason (required to excuse)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                disabled={busy}
                onClick={() => reviewSlot("FALSE")}
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-bad hover:underline disabled:opacity-60"
              >
                Mark false
              </button>
              <button
                disabled={busy}
                onClick={() => reviewSlot("EXCUSE")}
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline disabled:opacity-60"
              >
                Excuse
              </button>
              {activeSlot.slot.reviewStatus !== "VALID" && (
                <button
                  disabled={busy}
                  onClick={() => reviewSlot("UNDO")}
                  className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:underline disabled:opacity-60"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!activeAttendance}
        onClose={() => setActiveAttendance(null)}
        title={activeAttendance ? `${activeAttendance.staffName} — Late clock-in` : ""}
      >
        {activeAttendance && (
          <div className="space-y-3">
            <p className="font-mono text-sm">Clocked in at {fmt(activeAttendance.clockIn)}.</p>
            {activeAttendance.clockInExcused ? (
              <>
                <p className="font-mono text-[11px] text-muted">Currently excused.</p>
                <button
                  disabled={busy}
                  onClick={undoAttendanceExcuse}
                  className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:underline disabled:opacity-60"
                >
                  Undo excuse
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">Reason (required)</label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  disabled={busy}
                  onClick={excuseAttendance}
                  className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent hover:underline disabled:opacity-60"
                >
                  Excuse
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
