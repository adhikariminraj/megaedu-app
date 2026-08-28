"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PendingRow = {
  gradeHistoryId: string;
  studentId: string;
  studentName: string;
  fromGrade: string;
  fromSessionName: string;
  schoolGradeId: string;
  academicSessionId: string;
};
type SchoolGrade = { id: string; displayName: string };

export default function PendingQueue({
  schoolId,
  activeSessionId,
  activeSessionName,
  schoolGrades,
  pending,
}: {
  schoolId: string;
  activeSessionId: string;
  activeSessionName: string;
  schoolGrades: SchoolGrade[];
  pending: PendingRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [placeGradeId, setPlaceGradeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function placeEligibleNow() {
    setSaving(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/schools/${schoolId}/grade-rollover`, { method: "POST" });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setResult(
      data.placed > 0
        ? `Placed ${data.placed} student(s) who now have a recorded decision.`
        : "No newly-eligible students to place yet."
    );
    router.refresh();
  }

  async function manuallyPlaceSelected() {
    if (selected.size === 0 || !placeGradeId) {
      setError("Select at least one student and a grade.");
      return;
    }
    setSaving(true);
    setError(null);
    setResult(null);
    const placements = [...selected].map((studentId) => ({ studentId, schoolGradeId: placeGradeId }));
    const res = await fetch(`/api/schools/${schoolId}/grade-placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicSessionId: activeSessionId, placements }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setResult(`Manually placed ${data.created} student(s) in ${activeSessionName}.`);
    setSelected(new Set());
    setPlaceGradeId("");
    router.refresh();
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-6">
      <p className="text-sm font-semibold text-amber-800 mb-1">
        Pending / Unresolved ({pending.length})
      </p>
      <p className="text-xs text-amber-700 mb-3">
        These students have no recorded decision from a prior session, so they haven&apos;t been
        placed in {activeSessionName}. Resolve each one by recording their missing decision, or
        manually place them below.
      </p>

      {error && <p className="text-xs text-mega-red mb-2">{error}</p>}
      {result && <p className="text-xs text-green-700 mb-2">{result}</p>}

      <div className="bg-white border border-amber-100 rounded-lg divide-y divide-amber-50 mb-3">
        {pending.map((p) => (
          <div key={p.gradeHistoryId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <label className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked={selected.has(p.studentId)}
                onChange={() => toggle(p.studentId)}
                className="accent-amber-600 shrink-0"
              />
              <span className="font-medium text-slate-700 truncate">{p.studentName}</span>
              <span className="text-xs text-slate-400 truncate">
                — still enrolled in {p.fromGrade} ({p.fromSessionName})
              </span>
            </label>
            <Link
              href={`/dashboard/grades/${p.schoolGradeId}?session=${p.academicSessionId}`}
              className="text-xs font-semibold text-mega-navy shrink-0"
            >
              Record decision →
            </Link>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={placeEligibleNow}
          disabled={saving}
          className="bg-white border border-amber-300 text-amber-800 text-xs font-semibold px-3 py-2 rounded-full hover:bg-amber-100 transition disabled:opacity-50"
        >
          {saving ? "Checking..." : "Place eligible students now"}
        </button>

        <span className="text-xs text-amber-700">or manually place selected:</span>
        <select
          value={placeGradeId}
          onChange={(e) => setPlaceGradeId(e.target.value)}
          className="border border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-mega-blue"
        >
          <option value="">Select a grade...</option>
          {schoolGrades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.displayName}
            </option>
          ))}
        </select>
        <button
          onClick={manuallyPlaceSelected}
          disabled={saving || selected.size === 0 || !placeGradeId}
          className="bg-mega-navy text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          Place selected ({selected.size})
        </button>
      </div>
    </div>
  );
}
