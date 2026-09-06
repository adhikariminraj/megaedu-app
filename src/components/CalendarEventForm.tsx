"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Calendar K1 — School Admin's "+ Add Event" form, embedded directly on
 * the school-scoped Calendar page (matching Homework's own inline
 * create-form precedent, HomeworkClient.tsx) rather than a separate
 * management page. POSTs to /api/schools/[id]/events, the write path
 * built for this kilometer.
 */
export default function CalendarEventForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim() || !date) {
      setError("Title and date are required.");
      return;
    }
    if (!isAllDay && !time) {
      setError("Enter a time, or mark this as an all-day event.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/schools/${schoolId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        isAllDay,
        time: isAllDay ? undefined : time,
        location: location.trim() || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setTitle("");
    setDescription("");
    setDate("");
    setIsAllDay(true);
    setTime("");
    setLocation("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mb-6">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          {open ? "Cancel" : "+ Add Event"}
        </button>
      </div>

      {open && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-3">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <input
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
            All-day event
          </label>
          {!isAllDay && (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          )}
          {error && <p className="text-xs text-mega-red">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Event"}
          </button>
        </div>
      )}
    </div>
  );
}
