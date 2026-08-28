"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GradeReference = { id: string; code: string; order: number };
type SchoolGrade = {
  id: string;
  gradeReferenceId: string;
  displayName: string;
  gradeReference: { code: string; order: number };
};
type AcademicSession = {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
};
type Teacher = { id: string; name: string; email: string };
type TeacherAssignment = {
  id: string;
  teacherId: string;
  schoolGradeId: string;
  teacherName: string;
  gradeDisplayName: string;
};
type Suggestion = {
  studentId: string;
  name: string;
  gradeLevel: string | null;
  suggestedCode: string | null;
};

type Step = "session" | "grades" | "names" | "teachers" | "students" | "review";

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: "session", label: "1. Session" },
  { key: "grades", label: "2. Configure Grades" },
  { key: "names", label: "3. Display Names" },
  { key: "teachers", label: "4. Assign Teachers" },
  { key: "students", label: "5. Assign Students" },
  { key: "review", label: "6. Review & Confirm" },
];

function fmtDate(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function SetupWizard({
  schoolId,
  schoolName,
  gradeReferences,
  schoolGrades,
  activeSession,
  teachers,
  teacherAssignments,
  totalApprovedStudents,
  placedCount,
  suggestions,
}: {
  schoolId: string;
  schoolName: string;
  gradeReferences: GradeReference[];
  schoolGrades: SchoolGrade[];
  activeSession: AcademicSession | null;
  teachers: Teacher[];
  teacherAssignments: TeacherAssignment[];
  totalApprovedStudents: number;
  placedCount: number;
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    !activeSession ? "session" : schoolGrades.length === 0 ? "grades" : "teachers"
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Not an error — the create-session call still succeeded, it just
  // didn't create what the admin typed in. Kept separate from `error`
  // so it renders with its own (non-error) styling, and shown at the
  // top level (not scoped to the "session" step) since we immediately
  // advance past that step afterward.
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const furthestReachable: Step[] = ["session"];
  if (activeSession) furthestReachable.push("grades");
  if (activeSession && schoolGrades.length > 0) furthestReachable.push("names", "teachers", "students", "review");
  const canReach = (s: Step) => furthestReachable.includes(s);

  // ---------------- Step 1: Session ----------------
  const [sessionName, setSessionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function createSession() {
    if (!sessionName.trim() || !startDate || !endDate) {
      setError("Please fill in the session name and both dates.");
      return;
    }
    setSaving(true);
    setError(null);
    setSessionNotice(null);
    const res = await fetch(`/api/schools/${schoolId}/academic-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sessionName, startDate, endDate }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    if (data.alreadyActive) {
      setSessionNotice(
        `An academic session is already active for this school: "${data.session.name}". Your new session details were not used.`
      );
    }
    setStep("grades");
    router.refresh();
  }

  // ---------------- Step 2: Configure grades ----------------
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(
    new Set(schoolGrades.map((g) => g.gradeReferenceId))
  );

  function toggleRef(id: string) {
    setSelectedRefIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveGradeSelection() {
    if (selectedRefIds.size === 0) {
      setError("Select at least one grade this school uses.");
      return;
    }
    setSaving(true);
    setError(null);
    const grades = gradeReferences
      .filter((r) => selectedRefIds.has(r.id))
      .map((r) => {
        const existing = schoolGrades.find((g) => g.gradeReferenceId === r.id);
        return { gradeReferenceId: r.id, displayName: existing?.displayName || r.code };
      });
    const res = await fetch(`/api/schools/${schoolId}/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setStep("names");
    router.refresh();
  }

  // ---------------- Step 3: Display names ----------------
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(
    Object.fromEntries(schoolGrades.map((g) => [g.gradeReferenceId, g.displayName]))
  );

  async function saveDisplayNames() {
    setSaving(true);
    setError(null);
    const grades = gradeReferences
      .filter((r) => selectedRefIds.has(r.id))
      .map((r) => ({
        gradeReferenceId: r.id,
        displayName: (displayNames[r.id] ?? r.code).trim() || r.code,
      }));
    const res = await fetch(`/api/schools/${schoolId}/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setStep("teachers");
    router.refresh();
  }

  // ---------------- Step 4: Assign teachers ----------------
  const [teacherGradeMap, setTeacherGradeMap] = useState<Record<string, Set<string>>>({});

  function toggleTeacherGrade(teacherId: string, schoolGradeId: string) {
    setTeacherGradeMap((prev) => {
      const next = { ...prev };
      const set = new Set(next[teacherId] || []);
      if (set.has(schoolGradeId)) set.delete(schoolGradeId);
      else set.add(schoolGradeId);
      next[teacherId] = set;
      return next;
    });
  }

  async function saveTeacherAssignments() {
    if (!activeSession) return;
    const assignments: { teacherId: string; schoolGradeId: string }[] = [];
    for (const [teacherId, gradeIds] of Object.entries(teacherGradeMap)) {
      for (const schoolGradeId of gradeIds) assignments.push({ teacherId, schoolGradeId });
    }
    if (assignments.length === 0) {
      setError("Assign at least one teacher to a grade, or move on if none apply yet.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/teacher-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicSessionId: activeSession.id, assignments }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setTeacherGradeMap({});
    router.refresh();
  }

  async function removeAssignment(assignmentId: string) {
    await fetch(`/api/schools/${schoolId}/teacher-assignments/${assignmentId}`, { method: "DELETE" });
    router.refresh();
  }

  // ---------------- Step 5: Assign students ----------------
  const codeToSchoolGradeId = Object.fromEntries(
    schoolGrades.map((g) => [g.gradeReference.code, g.id])
  );
  const confidentSuggestions = suggestions.filter(
    (s) => s.suggestedCode && codeToSchoolGradeId[s.suggestedCode]
  );
  const manualQueue = suggestions.filter(
    (s) => !s.suggestedCode || !codeToSchoolGradeId[s.suggestedCode]
  );

  const [excludedConfident, setExcludedConfident] = useState<Set<string>>(new Set());
  function toggleExcluded(studentId: string) {
    setExcludedConfident((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function confirmMatches() {
    if (!activeSession) return;
    const placements = confidentSuggestions
      .filter((s) => !excludedConfident.has(s.studentId))
      .map((s) => ({ studentId: s.studentId, schoolGradeId: codeToSchoolGradeId[s.suggestedCode!] }));
    if (placements.length === 0) {
      setError("No confirmed matches to place.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/grade-placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicSessionId: activeSession.id, placements }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setExcludedConfident(new Set());
    router.refresh();
  }

  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [bulkGradeId, setBulkGradeId] = useState("");

  function toggleManual(studentId: string) {
    setManualSelection((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAllManual() {
    setManualSelection((prev) =>
      prev.size === manualQueue.length ? new Set() : new Set(manualQueue.map((s) => s.studentId))
    );
  }

  async function bulkAssignManual() {
    if (!activeSession || !bulkGradeId || manualSelection.size === 0) {
      setError("Select one or more students and a grade to bulk-assign.");
      return;
    }
    setSaving(true);
    setError(null);
    const placements = [...manualSelection].map((studentId) => ({
      studentId,
      schoolGradeId: bulkGradeId,
    }));
    const res = await fetch(`/api/schools/${schoolId}/grade-placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicSessionId: activeSession.id, placements }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setManualSelection(new Set());
    setBulkGradeId("");
    router.refresh();
  }

  // ---------------- Render ----------------
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">Initial Setup — {schoolName}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Academic Sessions &amp; Grades</h1>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-8">
        {STEP_ORDER.map((s) => (
          <button
            key={s.key}
            onClick={() => canReach(s.key) && setStep(s.key)}
            disabled={!canReach(s.key)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition ${
              step === s.key
                ? "border-mega-navy text-mega-navy"
                : canReach(s.key)
                ? "border-transparent text-slate-500 hover:text-slate-700"
                : "border-transparent text-slate-300 cursor-not-allowed"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-mega-red text-sm rounded-lg px-4 py-2.5 mb-6">
          {error}
        </div>
      )}

      {sessionNotice && (
        <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2.5 mb-6">
          <span>{sessionNotice}</span>
          <button
            onClick={() => setSessionNotice(null)}
            className="text-amber-600/60 hover:text-amber-800 shrink-0"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {step === "session" && (
        <div className="space-y-4">
          {activeSession ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-sm text-green-800">
              Active session: <strong>{activeSession.name}</strong> ({fmtDate(activeSession.startDate)} –{" "}
              {fmtDate(activeSession.endDate)})
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Every school needs an active Academic Session before grades can be configured. A
                school may only have one active session at a time.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Session name</label>
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
              </div>
              <button
                onClick={createSession}
                disabled={saving}
                className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Session & Continue"}
              </button>
            </>
          )}
          {activeSession && (
            <button
              onClick={() => setStep("grades")}
              className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition"
            >
              Continue →
            </button>
          )}
        </div>
      )}

      {step === "grades" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Pick every grade this school uses. You can add more later — nothing already selected
            will ever be removed automatically.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gradeReferences.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  selectedRefIds.has(r.id)
                    ? "border-mega-navy bg-blue-50 text-mega-navy font-medium"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRefIds.has(r.id)}
                  onChange={() => toggleRef(r.id)}
                  className="accent-mega-navy"
                />
                {r.code}
              </label>
            ))}
          </div>
          <button
            onClick={saveGradeSelection}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      )}

      {step === "names" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Give each grade a display name — defaults to the platform code, fully editable (e.g.
            &quot;Class 6&quot; instead of &quot;Y6&quot;).
          </p>
          <div className="space-y-2">
            {gradeReferences
              .filter((r) => selectedRefIds.has(r.id))
              .map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-mono text-slate-400">{r.code}</span>
                  <input
                    value={displayNames[r.id] ?? r.code}
                    onChange={(e) => setDisplayNames({ ...displayNames, [r.id]: e.target.value })}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                </div>
              ))}
          </div>
          <button
            onClick={saveDisplayNames}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      )}

      {step === "teachers" && activeSession && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Assign teachers to the grade(s) they teach for <strong>{activeSession.name}</strong>.
            Assignments are specific to this session and won&apos;t carry forward automatically
            next session.
          </p>

          {teacherAssignments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Already assigned
              </p>
              <div className="flex flex-wrap gap-2">
                {teacherAssignments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 text-xs bg-blue-50 text-mega-navy font-medium rounded-full px-3 py-1.5"
                  >
                    {a.teacherName} · {a.gradeDisplayName}
                    <button
                      onClick={() => removeAssignment(a.id)}
                      className="text-mega-navy/50 hover:text-mega-red"
                      title="Remove assignment"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="py-2 pr-4">Teacher</th>
                  {schoolGrades.map((g) => (
                    <th key={g.id} className="py-2 px-2 text-center">
                      {g.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-700">{t.name}</td>
                    {schoolGrades.map((g) => {
                      const already = teacherAssignments.some(
                        (a) => a.teacherId === t.id && a.schoolGradeId === g.id
                      );
                      return (
                        <td key={g.id} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            disabled={already}
                            checked={already || (teacherGradeMap[t.id]?.has(g.id) ?? false)}
                            onChange={() => toggleTeacherGrade(t.id, g.id)}
                            className="accent-mega-navy"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {teachers.length === 0 && (
            <p className="text-sm text-slate-400">No approved teachers at this school yet.</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={saveTeacherAssignments}
              disabled={saving}
              className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Assignments"}
            </button>
            <button
              onClick={() => setStep("students")}
              className="text-mega-navy font-semibold px-5 py-2.5 text-sm"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "students" && activeSession && (
        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Confident matches ({confidentSuggestions.length})
            </p>
            {confidentSuggestions.length === 0 ? (
              <p className="text-sm text-slate-400">
                None right now — every remaining student needs manual assignment below.
              </p>
            ) : (
              <>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-3">
                  {confidentSuggestions.map((s) => (
                    <label
                      key={s.studentId}
                      className="flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!excludedConfident.has(s.studentId)}
                          onChange={() => toggleExcluded(s.studentId)}
                          className="accent-mega-green"
                        />
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-xs text-slate-400">&quot;{s.gradeLevel}&quot;</span>
                      </span>
                      <span className="text-xs font-semibold text-mega-green bg-green-50 rounded-full px-2.5 py-1">
                        → {schoolGrades.find((g) => g.gradeReference.code === s.suggestedCode)?.displayName}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={confirmMatches}
                  disabled={saving}
                  className="bg-mega-green text-white text-sm font-semibold px-5 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
                >
                  {saving ? "Placing..." : "Confirm Checked Matches"}
                </button>
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Manual assignment queue ({manualQueue.length})
            </p>
            {manualQueue.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing needs manual assignment.</p>
            ) : (
              <>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-3 max-h-80 overflow-y-auto">
                  <label className="flex items-center gap-3 px-4 py-2 text-xs text-slate-500 bg-slate-50">
                    <input
                      type="checkbox"
                      checked={manualSelection.size === manualQueue.length}
                      onChange={toggleAllManual}
                      className="accent-mega-navy"
                    />
                    Select all
                  </label>
                  {manualQueue.map((s) => (
                    <label
                      key={s.studentId}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={manualSelection.has(s.studentId)}
                        onChange={() => toggleManual(s.studentId)}
                        className="accent-mega-navy"
                      />
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400">
                        {s.gradeLevel ? `"${s.gradeLevel}"` : "no grade on file"}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={bulkGradeId}
                    onChange={(e) => setBulkGradeId(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  >
                    <option value="">Assign selected to...</option>
                    {schoolGrades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={bulkAssignManual}
                    disabled={saving || manualSelection.size === 0 || !bulkGradeId}
                    className="bg-mega-navy text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
                  >
                    {saving ? "Placing..." : `Bulk-assign ${manualSelection.size || ""}`}
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={() => setStep("review")} className="text-mega-navy font-semibold px-0 py-2.5 text-sm">
            Continue to Review →
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-800">{schoolGrades.length}</p>
              <p className="text-sm text-slate-500">Grades configured</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-800">
                {new Set(teacherAssignments.map((a) => a.teacherId)).size}
              </p>
              <p className="text-sm text-slate-500">Teachers assigned</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-800">{placedCount}</p>
              <p className="text-sm text-slate-500">Students placed</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-800">
                {totalApprovedStudents - placedCount}
              </p>
              <p className="text-sm text-slate-500">Students still unmapped</p>
            </div>
          </div>

          {totalApprovedStudents - placedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
              {totalApprovedStudents - placedCount} student(s) still aren&apos;t placed in a grade
              this session. You can finish setup now and come back to{" "}
              <button onClick={() => setStep("students")} className="underline font-medium">
                Assign Students
              </button>{" "}
              later.
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="bg-mega-green text-white font-semibold px-6 py-3 rounded-full hover:brightness-95 transition"
          >
            Finish Setup
          </button>
        </div>
      )}
    </div>
  );
}
