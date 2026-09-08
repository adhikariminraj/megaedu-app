"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["COMPLETED", "PARTIAL", "NOT_COMPLETED", "EXCUSED"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<Status, string> = {
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  NOT_COMPLETED: "Not Completed",
  EXCUSED: "Excused",
};

type StudentRow = {
  applicabilityId: string;
  studentId: string;
  studentName: string;
  status: Status | null;
  version: number | null;
  recordedAt: string | null;
  recordedByTeacherName: string | null;
  submissionCount: number;
  reviewCount: number;
};

type Rollup = {
  assigned: number;
  unrecorded: number;
  completed: number;
  partial: number;
  notCompleted: number;
  excused: number;
  completionPercentage: number | null;
};

export default function CompletionClient({
  schoolId,
  homeworkId,
  homework,
}: {
  schoolId: string;
  homeworkId: string;
  homework: {
    title: string;
    subjectName: string;
    gradeDisplayName: string;
    sectionName: string | null;
    targetStudentName: string | null;
    dueDate: string;
  };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [pending, setPending] = useState<Record<string, Status>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoadError(null);
    const res = await fetch(`/api/schools/${schoolId}/homework/${homeworkId}/completion`);
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error || "Something went wrong.");
      return;
    }
    setRows(data.students);
    setRollup(data.rollup);
    setPending({});
    setRowErrors({});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, homeworkId]);

  function handleSelect(applicabilityId: string, status: Status) {
    setPending((p) => ({ ...p, [applicabilityId]: status }));
  }

  async function handleSave() {
    if (!rows || Object.keys(pending).length === 0) return;
    setSaving(true);
    setRowErrors({});

    const records = Object.entries(pending).map(([applicabilityId, status]) => {
      const row = rows.find((r) => r.applicabilityId === applicabilityId)!;
      return { applicabilityId, status, expectedVersion: row.version };
    });

    const res = await fetch(`/api/schools/${schoolId}/homework/${homeworkId}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setLoadError(data.error || "Something went wrong.");
      return;
    }

    const nextErrors: Record<string, string> = {};
    for (const outcome of data.results as { applicabilityId: string; ok: boolean; error?: string }[]) {
      if (!outcome.ok) nextErrors[outcome.applicabilityId] = outcome.error || "Could not save.";
    }
    setRowErrors(nextErrors);

    // Re-fetch so every row (including successfully-saved ones) reflects
    // the true current server state and version — never assume the
    // client's optimistic view is correct, especially for rows that
    // conflicted.
    await load();
    router.refresh();
  }

  const pendingCount = Object.keys(pending).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <a
        href={`/dashboard/schools/${schoolId}/homework`}
        className="text-sm text-mega-blue hover:underline mb-4 inline-block"
      >
        ← Back to Homework
      </a>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Record Completion</h1>
      <p className="text-sm text-slate-500 mb-1">
        {homework.title} — {homework.subjectName}
      </p>
      <p className="text-xs text-slate-400 mb-8">
        {homework.gradeDisplayName}{" "}
        {homework.targetStudentName
          ? `— Individual: ${homework.targetStudentName}`
          : homework.sectionName
          ? `— Section ${homework.sectionName}`
          : "— Whole Grade"}{" "}
        · Due {homework.dueDate}
      </p>

      {loadError && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6">{loadError}</p>
      )}

      {/* K5 — summary numbers, Regular Homework only. Individual
          Homework never gets a percentage (a single-target assignment
          has no meaningful class completion rate) — homework.
          targetStudentName already distinguishes the two above. */}
      {rollup && (
        <div className="border border-slate-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm text-slate-600">
            {rollup.assigned} assigned · {rollup.completed} completed · {rollup.partial} partial · {rollup.notCompleted} not
            completed · {rollup.excused} excused · {rollup.unrecorded} unrecorded
          </span>
          <span className="text-lg font-semibold text-mega-navy">
            {rollup.completionPercentage === null ? "N/A" : `${Math.round(rollup.completionPercentage)}%`}
          </span>
        </div>
      )}

      {!rows && !loadError && <p className="text-slate-400 text-sm">Loading…</p>}

      {rows && rows.length === 0 && <p className="text-slate-400 text-sm">No students applicable to this homework.</p>}

      {rows && rows.length > 0 && (
        <div className="space-y-2 mb-6">
          {rows.map((row) => {
            const currentValue = pending[row.applicabilityId] ?? row.status ?? "";
            const rowError = rowErrors[row.applicabilityId];
            return (
              <div
                key={row.applicabilityId}
                className={`border rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap ${
                  rowError ? "border-mega-red bg-red-50" : "border-slate-200"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-800 text-sm">{row.studentName}</p>
                  <p className="text-xs text-slate-400">
                    {row.status
                      ? `${STATUS_LABEL[row.status]} · recorded by ${row.recordedByTeacherName}`
                      : "Not yet recorded"}
                  </p>
                  {rowError && <p className="text-xs text-mega-red mt-1">{rowError}</p>}
                  <a
                    href={`/dashboard/schools/${schoolId}/homework/${homeworkId}/completion/${row.applicabilityId}`}
                    className="text-xs text-mega-blue hover:underline mt-1 inline-block"
                  >
                    {row.submissionCount > 0 ? `${row.submissionCount} submission(s)` : "No submission"}
                    {row.reviewCount > 0 ? ` · ${row.reviewCount} review(s)` : ""} · View / Give Feedback
                  </a>
                </div>
                <select
                  value={currentValue}
                  onChange={(e) => handleSelect(row.applicabilityId, e.target.value as Status)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mega-blue"
                >
                  <option value="" disabled>
                    Not yet recorded
                  </option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {rows && rows.length > 0 && (
        <button
          onClick={handleSave}
          disabled={pendingCount === 0 || saving}
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {saving ? "Saving..." : pendingCount > 0 ? `Save (${pendingCount})` : "Save"}
        </button>
      )}
    </div>
  );
}
