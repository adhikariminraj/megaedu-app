"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SchoolGradeRef = { id: string; displayName: string; gradeReference: { code: string; order: number } };
type RosterRow = { gradeHistoryId: string; studentName: string };
type Decision = "COMPLETED" | "REPEATED" | "TRANSFERRED" | "LEFT";

const DECISION_LABELS: Record<Decision, string> = {
  COMPLETED: "Promote",
  REPEATED: "Repeat",
  TRANSFERRED: "Transfer",
  LEFT: "Leave",
};

function decisionResultMessage(decision: Decision, count: number): string {
  const n = `${count} student${count === 1 ? "" : "s"}`;
  switch (decision) {
    case "COMPLETED":
      return `Promoted ${n}.`;
    case "REPEATED":
      return `Marked ${n} as repeating.`;
    case "TRANSFERRED":
      return `Marked ${n} as transferred.`;
    case "LEFT":
      return `Marked ${n} as left.`;
  }
}

export default function PromotionRoster({
  schoolId,
  schoolGrade,
  academicSessionName,
  isClosedSession,
  roster,
  allSchoolGrades,
}: {
  schoolId: string;
  schoolGrade: SchoolGradeRef;
  academicSessionName: string;
  isClosedSession?: boolean;
  roster: RosterRow[];
  allSchoolGrades: SchoolGradeRef[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Decision | "">("");
  const [outcomeGradeId, setOutcomeGradeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Default Promote suggestion: the nearest later GradeReference the
  // school has actually configured — editable via the dropdown below.
  const defaultPromoteTarget = allSchoolGrades
    .filter((g) => g.gradeReference.order > schoolGrade.gradeReference.order)
    .sort((a, b) => a.gradeReference.order - b.gradeReference.order)[0];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === roster.length ? new Set() : new Set(roster.map((r) => r.gradeHistoryId))));
  }

  function chooseDecision(d: Decision) {
    setDecision(d);
    setError(null);
    setResult(null);
    if (d === "COMPLETED") setOutcomeGradeId(defaultPromoteTarget?.id || "");
    else if (d === "REPEATED") setOutcomeGradeId(schoolGrade.id);
    else setOutcomeGradeId("");
  }

  async function apply() {
    if (selected.size === 0) {
      setError("Select at least one student.");
      return;
    }
    if (!decision) {
      setError("Choose Promote, Repeat, Transfer, or Leave.");
      return;
    }
    const needsOutcome = decision === "COMPLETED" || decision === "REPEATED";
    if (needsOutcome && !outcomeGradeId) {
      setError("Select which grade these students are moving to.");
      return;
    }
    setSaving(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/schools/${schoolId}/grade-decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gradeHistoryIds: [...selected],
        status: decision,
        outcomeSchoolGradeId: needsOutcome ? outcomeGradeId : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    const closedHint = isClosedSession
      ? " They still need placing in the current session — use \"Place eligible students now\" on the Grades page."
      : "";
    setResult(
      `${decisionResultMessage(decision, data.decided)}${data.skipped ? ` ${data.skipped} skipped (already decided).` : ""}${closedHint}`
    );
    setSelected(new Set());
    setDecision("");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/dashboard/grades" className="text-sm text-mega-blue font-medium">
        ← All grades
      </Link>
      <p className="text-sm text-slate-400 mt-3 mb-1">{academicSessionName}</p>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{schoolGrade.displayName} — Roster</h1>
        {isClosedSession && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            Closed session — resolving a pending decision
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-mega-red text-sm rounded-lg px-4 py-2.5 mb-4">
          {error}
        </div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 mb-4">
          {result}
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-slate-400 text-sm">No currently-enrolled students in this grade for this session.</p>
      ) : (
        <>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-4 max-h-96 overflow-y-auto">
            <label className="flex items-center gap-3 px-4 py-2 text-xs text-slate-500 bg-slate-50">
              <input
                type="checkbox"
                checked={selected.size === roster.length}
                onChange={toggleAll}
                className="accent-mega-navy"
              />
              Select all ({roster.length})
            </label>
            {roster.map((r) => (
              <label key={r.gradeHistoryId} className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(r.gradeHistoryId)}
                  onChange={() => toggle(r.gradeHistoryId)}
                  className="accent-mega-navy"
                />
                <span className="font-medium text-slate-700">{r.studentName}</span>
              </label>
            ))}
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Apply to {selected.size} selected
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DECISION_LABELS) as Decision[]).map((d) => (
                <button
                  key={d}
                  onClick={() => chooseDecision(d)}
                  className={`text-sm font-semibold px-4 py-2 rounded-full transition ${
                    decision === d
                      ? "bg-mega-navy text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {DECISION_LABELS[d]}
                </button>
              ))}
            </div>

            {(decision === "COMPLETED" || decision === "REPEATED") && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Moving to</label>
                <select
                  value={outcomeGradeId}
                  onChange={(e) => setOutcomeGradeId(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                >
                  <option value="">Select a grade...</option>
                  {allSchoolGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName}
                    </option>
                  ))}
                </select>
                {decision === "COMPLETED" && !defaultPromoteTarget && (
                  <p className="text-xs text-slate-400 mt-1">
                    No later grade is configured at this school — pick manually if needed.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={apply}
              disabled={saving || selected.size === 0 || !decision}
              className="bg-mega-green text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:brightness-95 transition disabled:opacity-50"
            >
              {saving ? "Applying..." : "Apply Decision"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
