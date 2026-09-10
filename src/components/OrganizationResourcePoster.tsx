"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrgResource = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  subject: string | null;
  gradeLevel: string | null;
};

/**
 * A7 — Organization Resource management. Mirrors OpportunityPoster's
 * exact interaction pattern (list + "+ Post" form + inline edit row +
 * delete). Resource has no prior write path anywhere (School included),
 * so this is the first UI for it — fileUrl stays a plain string per the
 * existing Resource model contract, no upload infrastructure added.
 */
export default function OrganizationResourcePoster({
  postEndpoint,
  resources,
}: {
  postEndpoint: string;
  resources: OrgResource[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", fileUrl: "", subject: "", gradeLevel: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", fileUrl: "", subject: "", gradeLevel: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(r: OrgResource) {
    setEditingId(r.id);
    setEditError(null);
    setEditForm({
      title: r.title,
      description: r.description || "",
      fileUrl: r.fileUrl || "",
      subject: r.subject || "",
      gradeLevel: r.gradeLevel || "",
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

  async function handleDelete(r: OrgResource) {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    setDeletingId(r.id);
    const res = await fetch(`${postEndpoint}/${r.id}`, { method: "DELETE" });
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
    setForm({ title: "", description: "", fileUrl: "", subject: "", gradeLevel: "" });
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">Resources</h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          {showForm ? "Cancel" : "+ Add Resource"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <input
            required
            placeholder="Title (e.g. STEM Lesson Plan Pack)"
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
          <input
            placeholder="Link to file (optional)"
            value={form.fileUrl}
            onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Subject (optional)"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <input
              placeholder="Grade level (optional)"
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          {error && <p className="text-sm text-mega-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Resource"}
          </button>
        </form>
      )}

      {resources.length === 0 ? (
        <p className="text-slate-400 text-sm">No resources posted yet.</p>
      ) : (
        <div className="space-y-2">
          {resources.map((r) =>
            editingId === r.id ? (
              <div key={r.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
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
                <input
                  placeholder="Link to file (optional)"
                  value={editForm.fileUrl}
                  onChange={(e) => setEditForm({ ...editForm, fileUrl: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Subject (optional)"
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  <input
                    placeholder="Grade level (optional)"
                    value={editForm.gradeLevel}
                    onChange={(e) => setEditForm({ ...editForm, gradeLevel: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
                {editError && <p className="text-sm text-mega-red">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(r.id)}
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
              <div key={r.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-slate-800">{r.title}</span>
                  <span className="text-xs text-slate-400 block">
                    {[r.subject, r.gradeLevel].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(r)}
                    className="text-xs font-semibold text-mega-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="text-xs font-semibold text-mega-red hover:underline disabled:opacity-50"
                  >
                    {deletingId === r.id ? "Deleting..." : "Delete"}
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
