"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminSchoolCalendarEntryRow } from "@/lib/schoolCalendar";

const RANGE_CATEGORIES = ["VACATION", "EXAMINATION", "SPECIAL_CLOSURE"] as const;
const POINT_CATEGORIES = ["PTM", "RESULT_DAY", "REPORT_CARD_DISTRIBUTION"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  VACATION: "Vacation",
  EXAMINATION: "Examination",
  SPECIAL_CLOSURE: "Special Closure",
  PTM: "Parent-Teacher Meeting",
  RESULT_DAY: "Result Day",
  REPORT_CARD_DISTRIBUTION: "Report Card Distribution",
};

type FormState = {
  title: string;
  category: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  category: "VACATION",
  description: "",
  date: "",
  startDate: "",
  endDate: "",
};

/**
 * Calendar K1.1 — School Admin's SchoolCalendarEntry management: create,
 * edit, deactivate. Deliberately its own component, separate from
 * CalendarEventForm (a different write path / model entirely) and from
 * CalendarAnnual/CalendarAgenda (display-only, shared by every role).
 * The form adapts to the selected category — a range picker for
 * VACATION/EXAMINATION/SPECIAL_CLOSURE, a single date for
 * PTM/RESULT_DAY/REPORT_CARD_DISTRIBUTION — but affectsDayStatus itself
 * is never a field here at all: the server derives it from category
 * alone (src/lib/schoolCalendar.ts), so this UI cannot produce an
 * invalid combination even if it tried.
 */
export default function SchoolCalendarManager({
  schoolId,
  existingEntries,
}: {
  schoolId: string;
  existingEntries: AdminSchoolCalendarEntryRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRange = (RANGE_CATEGORIES as readonly string[]).includes(form.category);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function startEdit(entry: AdminSchoolCalendarEntryRow) {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      category: entry.category,
      description: entry.description ?? "",
      date: entry.startDate,
      startDate: entry.startDate,
      endDate: entry.endDate,
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
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (isRange && (!form.startDate || !form.endDate)) {
      setError("Start date and end date are required.");
      return;
    }
    if (!isRange && !form.date) {
      setError("Date is required.");
      return;
    }
    setSaving(true);
    const url = editingId
      ? `/api/schools/${schoolId}/school-calendar/${editingId}`
      : `/api/schools/${schoolId}/school-calendar`;
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        ...(isRange ? { startDate: form.startDate, endDate: form.endDate } : { date: form.date }),
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

  async function deactivate(entry: AdminSchoolCalendarEntryRow) {
    if (!confirm(`Deactivate "${entry.title}"? It will no longer appear on the Calendar.`)) return;
    const res = await fetch(`/api/schools/${schoolId}/school-calendar/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">School Calendar</p>
        <button
          onClick={() => (open ? close() : startCreate())}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          {open ? "Cancel" : "+ Add School Calendar Entry"}
        </button>
      </div>

      {open && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-3">
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          >
            {[...RANGE_CATEGORIES, ...POINT_CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            placeholder="Title (e.g. Dashain Vacation)"
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
          {isRange ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                Start Date
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
              </label>
              <label className="text-xs text-slate-500">
                End Date
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full mt-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
              </label>
            </div>
          ) : (
            <label className="text-xs text-slate-500 block">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full mt-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </label>
          )}
          {error && <p className="text-xs text-mega-red">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Entry"}
          </button>
        </div>
      )}

      {existingEntries.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {existingEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2"
            >
              <span className="text-slate-700">
                {entry.startDate === entry.endDate ? entry.startDate : `${entry.startDate} – ${entry.endDate}`} —{" "}
                {entry.title}
                <span className="text-slate-400"> ({CATEGORY_LABELS[entry.category]})</span>
              </span>
              <span className="flex gap-3 text-xs shrink-0 ml-3">
                <button onClick={() => startEdit(entry)} className="text-mega-blue hover:underline">
                  Edit
                </button>
                <button onClick={() => deactivate(entry)} className="text-mega-red hover:underline">
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
