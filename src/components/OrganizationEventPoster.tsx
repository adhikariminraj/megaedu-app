"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrgEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | Date;
  isAllDay: boolean;
  location: string | null;
  onlineUrl: string | null;
  isActive: boolean;
};

type FormState = {
  title: string;
  description: string;
  date: string;
  isAllDay: boolean;
  time: string;
  location: string;
  onlineUrl: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  date: "",
  isAllDay: true,
  time: "",
  location: "",
  onlineUrl: "",
};

function toDateInputValue(startsAt: string | Date): string {
  return new Date(startsAt).toISOString().slice(0, 10);
}

/**
 * A7 — Organization Event management. Follows OpportunityPoster's
 * interaction style (list + "+ Post" form + inline edit row), not
 * School's dedicated Calendar page/CalendarEventForm — Organizations
 * don't get a Calendar subsystem in this kilometer. No DELETE:
 * deactivation (isActive: false) is the only removal path, matching
 * School Event's existing convention on the same underlying model.
 */
export default function OrganizationEventPoster({
  postEndpoint,
  events,
}: {
  postEndpoint: string;
  events: OrgEvent[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  function startEdit(ev: OrgEvent) {
    setEditingId(ev.id);
    setEditError(null);
    setEditForm({
      title: ev.title,
      description: ev.description || "",
      date: toDateInputValue(ev.startsAt),
      isAllDay: ev.isAllDay,
      time: ev.isAllDay ? "" : new Date(ev.startsAt).toTimeString().slice(0, 5),
      location: ev.location || "",
      onlineUrl: ev.onlineUrl || "",
    });
  }

  async function saveEdit(id: string) {
    if (!editForm.title.trim() || !editForm.date) return;
    if (!editForm.isAllDay && !editForm.time) {
      setEditError("Enter a time, or mark this as an all-day event.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    const res = await fetch(`${postEndpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        date: editForm.date,
        isAllDay: editForm.isAllDay,
        time: editForm.isAllDay ? undefined : editForm.time,
        location: editForm.location.trim() || undefined,
        onlineUrl: editForm.onlineUrl.trim() || undefined,
      }),
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

  async function handleDeactivate(ev: OrgEvent) {
    if (!confirm(`Deactivate "${ev.title}"? It will no longer appear on the Organization profile.`)) return;
    setDeactivatingId(ev.id);
    const res = await fetch(`${postEndpoint}/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    setDeactivatingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    if (!form.isAllDay && !form.time) {
      setError("Enter a time, or mark this as an all-day event.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(postEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        date: form.date,
        isAllDay: form.isAllDay,
        time: form.isAllDay ? undefined : form.time,
        location: form.location.trim() || undefined,
        onlineUrl: form.onlineUrl.trim() || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    router.refresh();
  }

  const activeEvents = events.filter((ev) => ev.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">Events</h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          {showForm ? "Cancel" : "+ Add Event"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <input
            required
            placeholder="Title (e.g. Open House 2026)"
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
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <input
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <input
            placeholder="Online link (optional)"
            value={form.onlineUrl}
            onChange={(e) => setForm({ ...form, onlineUrl: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isAllDay}
              onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
            />
            All-day event
          </label>
          {!form.isAllDay && (
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          )}
          {error && <p className="text-sm text-mega-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Event"}
          </button>
        </form>
      )}

      {activeEvents.length === 0 ? (
        <p className="text-slate-400 text-sm">No events posted yet.</p>
      ) : (
        <div className="space-y-2">
          {activeEvents.map((ev) =>
            editingId === ev.id ? (
              <div key={ev.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
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
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  <input
                    placeholder="Location (optional)"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
                <input
                  placeholder="Online link (optional)"
                  value={editForm.onlineUrl}
                  onChange={(e) => setEditForm({ ...editForm, onlineUrl: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isAllDay}
                    onChange={(e) => setEditForm({ ...editForm, isAllDay: e.target.checked })}
                  />
                  All-day event
                </label>
                {!editForm.isAllDay && (
                  <input
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                )}
                {editError && <p className="text-sm text-mega-red">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(ev.id)}
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
              <div key={ev.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-slate-800">{ev.title}</span>
                  <span className="text-xs text-slate-400 block">
                    {toDateInputValue(ev.startsAt)}
                    {!ev.isAllDay ? ` · ${new Date(ev.startsAt).toTimeString().slice(0, 5)}` : ""}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(ev)}
                    className="text-xs font-semibold text-mega-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(ev)}
                    disabled={deactivatingId === ev.id}
                    className="text-xs font-semibold text-mega-red hover:underline disabled:opacity-50"
                  >
                    {deactivatingId === ev.id ? "Deactivating..." : "Deactivate"}
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
