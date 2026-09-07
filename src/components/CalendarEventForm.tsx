"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminEventRow } from "@/lib/events";

type FormState = {
  title: string;
  description: string;
  date: string;
  isAllDay: boolean;
  time: string;
  location: string;
};

const EMPTY_FORM: FormState = { title: "", description: "", date: "", isAllDay: true, time: "", location: "" };

/**
 * Calendar K1 / K1.1 — School Admin's Event management: create (K1) plus
 * edit/deactivate (K1.1) for the school's own upcoming Events, using the
 * write path's existing PATCH route (isActive:false is the only removal
 * path — no DELETE). Deliberately kept out of CalendarAnnual/
 * CalendarAgenda — those stay display-only and are shared by every role;
 * this component is the one place Admin-only Event mutation lives.
 */
export default function CalendarEventForm({
  schoolId,
  existingEvents,
}: {
  schoolId: string;
  existingEvents: AdminEventRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function startEdit(ev: AdminEventRow) {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      date: ev.date,
      isAllDay: ev.isAllDay,
      time: ev.time ?? "",
      location: ev.location ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!form.title.trim() || !form.date) {
      setError("Title and date are required.");
      return;
    }
    if (!form.isAllDay && !form.time) {
      setError("Enter a time, or mark this as an all-day event.");
      return;
    }
    setSaving(true);
    const url = editingId ? `/api/schools/${schoolId}/events/${editingId}` : `/api/schools/${schoolId}/events`;
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        date: form.date,
        isAllDay: form.isAllDay,
        time: form.isAllDay ? undefined : form.time,
        location: form.location.trim() || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    close();
    router.refresh();
  }

  async function deactivate(ev: AdminEventRow) {
    if (!confirm(`Deactivate "${ev.title}"? It will no longer appear on the Calendar.`)) return;
    const res = await fetch(`/api/schools/${schoolId}/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-6">
      <div className="flex justify-end">
        <button
          onClick={() => (open ? close() : startCreate())}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          {open ? "Cancel" : "+ Add Event"}
        </button>
      </div>

      {open && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-3">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <input
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isAllDay}
              onChange={(e) => setForm((f) => ({ ...f, isAllDay: e.target.checked }))}
            />
            All-day event
          </label>
          {!form.isAllDay && (
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          )}
          {error && <p className="text-xs text-mega-red">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Event"}
          </button>
        </div>
      )}

      {existingEvents.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your School Events</p>
          {existingEvents.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2"
            >
              <span className="text-slate-700">
                {ev.date}
                {ev.time ? ` · ${ev.time}` : ""} — {ev.title}
              </span>
              <span className="flex gap-3 text-xs shrink-0 ml-3">
                <button onClick={() => startEdit(ev)} className="text-mega-blue hover:underline">
                  Edit
                </button>
                <button onClick={() => deactivate(ev)} className="text-mega-red hover:underline">
                  Deactivate
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
