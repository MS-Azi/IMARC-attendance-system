"use client";

import { useEffect, useState } from "react";
import CornerBrackets from "@/app/_components/CornerBrackets";

type Staff = {
  id: string;
  fullName: string;
  loginId: string;
  position: string;
  staffCode: string | null;
  department: string | null;
  dateJoined: string;
  active: boolean;
};

const emptyForm = {
  fullName: "",
  loginId: "",
  password: "",
  position: "",
  staffCode: "",
  department: "",
  dateJoined: "",
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/staff");
    const data = await res.json();
    setStaff(data.staff || []);
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function toggleActive(s: Staff) {
    await fetch(`/api/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight mb-1 glow">Staff</h1>
          <p className="font-mono text-muted text-[11px] uppercase tracking-[0.18em]">{staff.filter((s) => s.active).length} active</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring glow-box relative self-start sm:self-auto rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white"
        >
          <CornerBrackets />
          {showForm ? "Cancel" : "Add staff"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addStaff} className="glass relative rounded-card p-4 md:p-6 mb-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CornerBrackets />
          <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
          <Field label="Login ID (phone or email)" value={form.loginId} onChange={(v) => setForm({ ...form, loginId: v })} required />
          <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} required />
          <Field label="Staff ID (optional)" value={form.staffCode} onChange={(v) => setForm({ ...form, staffCode: v })} />
          <Field label="Department (optional)" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
          <Field label="Date joined" type="date" value={form.dateJoined} onChange={(v) => setForm({ ...form, dateJoined: v })} />
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="focus-ring rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save staff member"}
            </button>
            {error && <p className="font-mono text-bad text-xs">{error}</p>}
          </div>
        </form>
      )}

      <div className="relative">
        <div className="glass rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Name</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Position</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Department</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Login ID</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">Status</th>
                <th className="px-3 py-2.5 md:px-5 md:py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 md:px-5 md:py-3">{s.fullName}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{s.position}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 text-muted">{s.department || "—"}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 font-mono text-muted">{s.loginId}</td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${s.active ? "text-good" : "text-bad"}`}>{s.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-3 py-2.5 md:px-5 md:py-3 text-right">
                    <button onClick={() => toggleActive(s)} className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
                      {s.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-card bg-gradient-to-l from-surface to-transparent md:hidden"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[0.13em] text-muted mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm text-ink"
      />
    </div>
  );
}
