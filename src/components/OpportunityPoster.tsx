"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opportunity = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  deadline: string | Date | null;
  applyUrl?: string | null;
};

const TYPES = ["Scholarship", "Competition", "Event", "Job", "Other"];

export default function OpportunityPoster({
  postEndpoint,
  opportunities,
}: {
  postEndpoint: string;
  opportunities: Opportunity[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Scholarship",
    deadline: "",
    applyUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Kilometer 3 — inline edit/delete, mirroring the existing
  // Program/NewsPost inline-edit pattern (DashboardClient.tsx). Kept
  // entirely separate from the "post new" form's own state above.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", type: "Scholarship", deadline: "", applyUrl: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(o: Opportunity) {
    setEditingId(o.id);
    setEditError(null);
    setEditForm({
      title: o.title,
      description: o.description || "",
      type: o.type,
      deadline: o.deadline ? new Date(o.deadline).toISOString().slice(0, 10) : "",
      applyUrl: o.applyUrl || "",
    });
  }

  async function saveEdit(id: string) {
    if (!editForm.title.trim()) return;
    setEditLoading(true);
    setEditError(null);
    const res = await fetch(`${postEndpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    setEditLoading(false);
    if (!res.ok) {
      setEditError(data.error || "Something went wrong.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(o: Opportunity) {
    if (!confirm(`Delete "${o.title}"? This cannot be undone.`)) return;
    setDeletingId(o.id);
    const res = await fetch(`${postEndpoint}/${o.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(postEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setForm({ title: "", description: "", type: "Scholarship", deadline: "", applyUrl: "" });
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Opportunities Posted</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition"
        >
          {showForm ? "Cancel" : "+ Post Opportunity"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <input
            required
            placeholder="Title (e.g. National Science Scholarship 2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <input
            placeholder="Link to apply / learn more (optional)"
            value={form.applyUrl}
            onChange={(e) => setForm({ ...form, applyUrl: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          {error && <p className="text-sm text-mega-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Opportunity"}
          </button>
        </form>
      )}

      {opportunities.length === 0 ? (
        <p className="text-slate-400 text-sm">Nothing posted yet.</p>
      ) : (
        <div className="space-y-2">
          {opportunities.map((o) =>
            editingId === o.id ? (
              <div key={o.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
                <input
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <textarea
                  placeholder="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
                <input
                  placeholder="Link to apply / learn more (optional)"
                  value={editForm.applyUrl}
                  onChange={(e) => setEditForm({ ...editForm, applyUrl: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                {editError && <p className="text-sm text-mega-red">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(o.id)}
                    disabled={editLoading}
                    className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
                  >
                    {editLoading ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={editLoading}
                    className="bg-slate-100 text-slate-600 text-sm font-semibold px-4 py-2 rounded-full hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={o.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-slate-800">{o.title}</span>
                  <span className="text-xs text-slate-400 block">
                    {o.type}
                    {o.deadline ? ` · Deadline ${new Date(o.deadline).toLocaleDateString()}` : ""}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(o)}
                    className="text-xs font-semibold text-mega-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(o)}
                    disabled={deletingId === o.id}
                    className="text-xs font-semibold text-mega-red hover:underline disabled:opacity-50"
                  >
                    {deletingId === o.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
