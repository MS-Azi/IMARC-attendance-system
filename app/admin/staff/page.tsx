"use client";

import { useEffect, useState } from "react";

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
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="font-display text-2xl italic mb-1 glow">Staff</h1>
          <p className="text-muted text-sm">{staff.filter((s) => s.active).length} active</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring glow-box rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "Cancel" : "Add staff"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addStaff} className="glass rounded-card p-6 mb-7 grid grid-cols-2 gap-4">
          <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
          <Field label="Login ID (phone or email)" value={form.loginId} onChange={(v) => setForm({ ...form, loginId: v })} required />
          <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} required />
          <Field label="Staff ID (optional)" value={form.staffCode} onChange={(v) => setForm({ ...form, staffCode: v })} />
          <Field label="Department (optional)" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
          <Field label="Date joined" type="date" value={form.dateJoined} onChange={(v) => setForm({ ...form, dateJoined: v })} />
          <div className="col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="focus-ring rounded-md bg-accent hover:bg-accentDim transition-colors px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save staff member"}
            </button>
            {error && <p className="text-bad text-sm">{error}</p>}
          </div>
        </form>
      )}

      <div className="glass rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-3 font-normal">Name</th>
              <th className="px-5 py-3 font-normal">Position</th>
              <th className="px-5 py-3 font-normal">Department</th>
              <th className="px-5 py-3 font-normal">Login ID</th>
              <th className="px-5 py-3 font-normal">Status</th>
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{s.fullName}</td>
                <td className="px-5 py-3 text-muted">{s.position}</td>
                <td className="px-5 py-3 text-muted">{s.department || "—"}</td>
                <td className="px-5 py-3 text-muted">{s.loginId}</td>
                <td className="px-5 py-3">
                  <span className={s.active ? "text-good" : "text-bad"}>{s.active ? "Active" : "Inactive"}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => toggleActive(s)} className="text-muted hover:text-ink text-xs">
                    {s.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <label className="block text-xs text-muted mb-1.5">{label}</label>
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
