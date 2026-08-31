"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SchoolGradeRef = { id: string; displayName: string; gradeReference: { code: string; order: number } };
type RosterRow = {
  gradeHistoryId: string;
  studentId: string;
  studentName: string;
  sectionId: string | null;
  sectionName: string | null;
  rollNo: string;
  isRepeated: boolean;
  resultLabel: string | null;
  rank: number | null;
};
type SectionOption = { id: string; name: string };
type TeacherAssignmentRow = { id: string; teacherName: string; subjectName: string; sectionName: string | null };
type AssessmentStatus = "NO_FRAMEWORK" | "IN_PROGRESS" | "PUBLISHED";
type Decision = "COMPLETED" | "REPEATED" | "TRANSFERRED" | "LEFT";

const RANK_STYLES: Record<number, { badge: string; row: string }> = {
  1: { badge: "🥇 Rank 1", row: "bg-amber-50 border-amber-200" },
  2: { badge: "🥈 Rank 2", row: "bg-slate-100 border-slate-300" },
  3: { badge: "🥉 Rank 3", row: "bg-orange-50 border-orange-200" },
  4: { badge: "Rank 4", row: "bg-sky-50 border-sky-200" },
  5: { badge: "Rank 5", row: "bg-green-50 border-green-200" },
};

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
  sections,
  teacherAssignments,
  assessmentStatus,
}: {
  schoolId: string;
  schoolGrade: SchoolGradeRef;
  academicSessionName: string;
  isClosedSession?: boolean;
  roster: RosterRow[];
  allSchoolGrades: SchoolGradeRef[];
  sections: SectionOption[];
  teacherAssignments: TeacherAssignmentRow[];
  assessmentStatus: AssessmentStatus;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Prefer real browser history (so "Back" returns to whatever page
  // actually linked here — the Grades page, the Pending queue, etc.);
  // fall back to the Grades page only when there's nothing to go back
  // to (a bookmarked/direct link, or history from outside the app).
  function goBack() {
    const cameFromThisApp =
      typeof window !== "undefined" && window.history.length > 1 && document.referrer.startsWith(window.location.origin);
    if (cameFromThisApp) router.back();
    else router.push("/dashboard/grades");
  }

  const uniqueTeacherCount = new Set(teacherAssignments.map((t) => t.teacherName)).size;
  const hasTop5 = roster.some((r) => r.rank !== null);

  // Grouped for DISPLAY only — the section a student is shown under
  // comes straight from their own CURRENT-session GradeHistory row
  // (sectionName, resolved server-side, never an older record), so a
  // new admission or a repeated student placed into a section already
  // shows up correctly grouped with no extra logic here. A student
  // with no section falls into "Unassigned" rather than being dropped.
  // Ranking is NOT recomputed per group — r.rank already reflects the
  // grade-wide ranking computed once, server-side, and just travels
  // with each row regardless of which section block renders it.
  const sectionNames = [...new Set(roster.map((r) => r.sectionName).filter((n): n is string => n !== null))].sort();
  const groupOrder = [...sectionNames, null]; // named sections alphabetically, "Unassigned" last
  const rosterBySection = new Map<string | null, typeof roster>();
  for (const key of groupOrder) rosterBySection.set(key, []);
  for (const r of roster) (rosterBySection.get(r.sectionName) ?? rosterBySection.get(null)!).push(r);
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

  // Section reassignment — deliberately a separate action from the
  // promotion decision above (its own button, its own endpoint, its own
  // audited write path — reassignSection() via /section-assignments,
  // never grade-decisions), so choosing to promote a group of students
  // never implies anything about their section, and vice versa. It does
  // reuse the SAME checkbox selection as the promotion panel above —
  // one shared "who am I acting on" list, two independent actions you
  // can apply to it — rather than a second, disconnected selection UI.
  const [sectionPick, setSectionPick] = useState("");
  const [sectionResult, setSectionResult] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function applySectionAssignment() {
    if (selected.size === 0 || !sectionPick) {
      setSectionError("Select at least one student and a section.");
      return;
    }
    setSaving(true);
    setSectionError(null);
    setSectionResult(null);
    const res = await fetch(`/api/schools/${schoolId}/section-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeHistoryIds: [...selected], sectionId: sectionPick }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSectionError(data.error || "Something went wrong.");
      return;
    }
    setSectionResult(`Assigned section to ${data.reassigned} student(s).`);
    setSelected(new Set());
    setSectionPick("");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <button onClick={goBack} className="text-sm text-mega-blue font-medium">
        ← Back
      </button>
      <p className="text-sm text-slate-400 mt-3 mb-1">{academicSessionName}</p>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-800">{schoolGrade.displayName}</h1>
        {isClosedSession && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            Closed session — resolving a pending decision
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5">
          Total Students: {roster.length}
        </span>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5">
          Sections: {sectionNames.length}
        </span>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5">
          Teachers: {uniqueTeacherCount}
        </span>
        <span
          className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
            assessmentStatus === "PUBLISHED"
              ? "bg-green-100 text-green-700"
              : assessmentStatus === "IN_PROGRESS"
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {assessmentStatus === "PUBLISHED"
            ? "Results published"
            : assessmentStatus === "IN_PROGRESS"
            ? "Assessments in progress — none published yet"
            : "No assessment framework assigned yet"}
        </span>
      </div>

      {sectionNames.length > 0 && (
        <p className="text-xs text-slate-400 mb-6">
          {sectionNames
            .map((name) => `Section ${name}: ${rosterBySection.get(name)!.length} student${rosterBySection.get(name)!.length === 1 ? "" : "s"}`)
            .join(" · ")}
          {rosterBySection.get(null)!.length > 0 && ` · Unassigned: ${rosterBySection.get(null)!.length}`}
        </p>
      )}

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Teachers</h2>
        {teacherAssignments.length === 0 ? (
          <p className="text-slate-400 text-sm">No subject-teacher assignments recorded for this grade this session.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {teacherAssignments.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{t.subjectName}</span>
                <span className="text-slate-500">
                  {t.teacherName}
                  {t.sectionName && <span className="text-slate-400 text-xs"> — Section {t.sectionName}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Students</h2>
      <p className="text-xs text-slate-400 mb-3">
        Roll No. shown here is each section&apos;s alphabetical position — MEGA.EDU doesn&apos;t yet store an official roll number. Ranking is grade-wide, not reset per section.
      </p>

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
          {hasTop5 ? (
            <p className="text-xs text-slate-500 mb-2">🏆 Top 5 students highlighted below, based on published assessment results.</p>
          ) : (
            <p className="text-xs text-slate-400 mb-2">
              Student rankings will appear after the first assessment results are published.
            </p>
          )}

          <label className="flex items-center gap-3 px-4 py-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl mb-3">
            <input
              type="checkbox"
              checked={selected.size === roster.length}
              onChange={toggleAll}
              className="accent-mega-navy"
            />
            Select all ({roster.length})
          </label>

          <div className="space-y-4 mb-4">
            {groupOrder.map((key) => {
              const group = rosterBySection.get(key)!;
              if (group.length === 0) return null;
              return (
                <div key={key ?? "unassigned"}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">
                    {key ? `Section ${key}` : "Unassigned / No Section"} — {group.length} Student{group.length === 1 ? "" : "s"}
                  </p>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {group.map((r) => {
                      const rankStyle = r.rank ? RANK_STYLES[r.rank] : null;
                      return (
                        <label
                          key={r.gradeHistoryId}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer border-l-4 ${
                            rankStyle ? rankStyle.row : "border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(r.gradeHistoryId)}
                            onChange={() => toggle(r.gradeHistoryId)}
                            className="accent-mega-navy"
                          />
                          <span className="text-xs text-slate-400 w-8">{r.rollNo}</span>
                          <span className="font-medium text-slate-700 flex-1">{r.studentName}</span>
                          {rankStyle && (
                            <span className="text-xs font-semibold bg-white/70 border border-slate-200 rounded-full px-2 py-0.5">
                              {rankStyle.badge}
                            </span>
                          )}
                          {r.resultLabel && <span className="text-xs font-medium text-slate-600">{r.resultLabel}</span>}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              r.isRepeated ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {r.isRepeated ? "Repeated" : "Regular"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

          {sections.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Assign section — separate from promotion, {selected.size} selected above
              </p>
              {sectionError && <p className="text-xs text-mega-red">{sectionError}</p>}
              {sectionResult && <p className="text-xs text-green-700">{sectionResult}</p>}
              <div className="flex items-center gap-2">
                <select
                  value={sectionPick}
                  onChange={(e) => setSectionPick(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                >
                  <option value="">Select a section...</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={applySectionAssignment}
                  disabled={saving || selected.size === 0 || !sectionPick}
                  className="bg-mega-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
                >
                  {saving ? "Assigning..." : "Assign Section"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
