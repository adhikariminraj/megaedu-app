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
type Teacher = { id: string; name: string; email: string | null };
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
type SectionRow = { id: string; schoolGradeId: string; name: string; isActive: boolean };
type PlacedStudent = {
  gradeHistoryId: string;
  studentId: string;
  studentName: string;
  schoolGradeId: string;
  gradeDisplayName: string;
  sectionId: string | null;
  sectionName: string | null;
};

type Step = "session" | "grades" | "names" | "sections" | "teachers" | "students" | "review";

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: "session", label: "1. Session" },
  { key: "grades", label: "2. Configure Grades" },
  { key: "names", label: "3. Display Names" },
  { key: "sections", label: "4. Create Sections" },
  { key: "teachers", label: "5. Assign Teachers" },
  { key: "students", label: "6. Assign Students" },
  { key: "review", label: "7. Review & Confirm" },
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
  sections,
  placedStudents,
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
  sections: SectionRow[];
  placedStudents: PlacedStudent[];
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
  if (activeSession && schoolGrades.length > 0)
    furthestReachable.push("names", "sections", "teachers", "students", "review");
  const canReach = (s: Step) => furthestReachable.includes(s);

  // ---------------- Step: Create sections ----------------
  const [newSectionNames, setNewSectionNames] = useState<Record<string, string>>({});
  const sectionsByGrade = (schoolGradeId: string) => sections.filter((s) => s.schoolGradeId === schoolGradeId);

  async function addSections(schoolGradeId: string) {
    const raw = newSectionNames[schoolGradeId] || "";
    const names = raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError("Enter at least one section name (e.g. \"A, B, C\").");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/grades/${schoolGradeId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setNewSectionNames({ ...newSectionNames, [schoolGradeId]: "" });
    router.refresh();
  }

  async function toggleSectionActive(sectionId: string, isActive: boolean) {
    await fetch(`/api/schools/${schoolId}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

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
    setStep("sections");
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

  // ---------------- Step 6b: Assign already-placed students to sections ----------------
  // Grouped by grade — only grades with at least one active section show
  // here, since sections are optional and a grade that doesn't use them
  // has nothing to assign. This is the audited reassignSection() path
  // (via /section-assignments), never grade-placements — these students
  // already have a GradeHistory row for this session.
  const [sectionSelection, setSectionSelection] = useState<Record<string, Set<string>>>({});
  const [sectionPick, setSectionPick] = useState<Record<string, string>>({});

  function toggleSectionSelection(schoolGradeId: string, studentId: string) {
    setSectionSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[schoolGradeId] || []);
      if (set.has(studentId)) set.delete(studentId);
      else set.add(studentId);
      next[schoolGradeId] = set;
      return next;
    });
  }

  async function assignSectionsForGrade(schoolGradeId: string) {
    const selected = sectionSelection[schoolGradeId];
    const sectionId = sectionPick[schoolGradeId];
    if (!selected?.size || !sectionId) {
      setError("Select at least one student and a section.");
      return;
    }
    const gradeHistoryIds = placedStudents
      .filter((p) => p.schoolGradeId === schoolGradeId && selected.has(p.studentId))
      .map((p) => p.gradeHistoryId);
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/section-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeHistoryIds, sectionId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setSectionSelection({ ...sectionSelection, [schoolGradeId]: new Set() });
    setSectionPick({ ...sectionPick, [schoolGradeId]: "" });
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

      {step === "sections" && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Optional — only set this up for grades that actually split into sections. Names can be
            anything (&quot;A, B, C&quot;, &quot;1, 2, 3&quot;, &quot;Red, Blue&quot;) and there&apos;s
            no limit on how many a grade can have.
          </p>
          <div className="space-y-4">
            {gradeReferences
              .filter((r) => selectedRefIds.has(r.id))
              .map((r) => {
                const grade = schoolGrades.find((g) => g.gradeReferenceId === r.id);
                if (!grade) return null;
                const gradeSections = sectionsByGrade(grade.id);
                return (
                  <div key={grade.id} className="border border-slate-200 rounded-xl p-4">
                    <p className="font-medium text-slate-800 mb-2">{grade.displayName}</p>
                    {gradeSections.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {gradeSections.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 ${
                              s.isActive
                                ? "bg-blue-50 text-mega-navy"
                                : "bg-slate-100 text-slate-400 line-through"
                            }`}
                          >
                            {s.name}
                            <button
                              onClick={() => toggleSectionActive(s.id, s.isActive)}
                              className="text-[10px] font-semibold no-underline"
                              title={s.isActive ? "Deactivate" : "Reactivate"}
                            >
                              {s.isActive ? "deactivate" : "reactivate"}
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={newSectionNames[grade.id] || ""}
                        onChange={(e) =>
                          setNewSectionNames({ ...newSectionNames, [grade.id]: e.target.value })
                        }
                        placeholder="e.g. A, B, C"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                      />
                      <button
                        onClick={() => addSections(grade.id)}
                        disabled={saving}
                        className="bg-slate-100 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <button
            onClick={() => setStep("teachers")}
            className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition"
          >
            Continue →
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

          {sections.some((s) => s.isActive) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Assign sections
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Optional, and separate from grade placement — a student&apos;s grade and section are
                two different decisions. Only students already placed in a grade this session are
                listed here.
              </p>
              <div className="space-y-3">
                {schoolGrades
                  .filter((g) => sectionsByGrade(g.id).some((s) => s.isActive))
                  .map((g) => {
                    const gradeStudents = placedStudents.filter((p) => p.schoolGradeId === g.id);
                    const selected = sectionSelection[g.id] || new Set<string>();
                    if (gradeStudents.length === 0) return null;
                    return (
                      <div key={g.id} className="border border-slate-200 rounded-xl p-4">
                        <p className="font-medium text-slate-800 mb-2">{g.displayName}</p>
                        <div className="divide-y divide-slate-100 mb-3 max-h-48 overflow-y-auto">
                          {gradeStudents.map((p) => (
                            <label
                              key={p.studentId}
                              className="flex items-center justify-between gap-3 py-1.5 text-sm cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected.has(p.studentId)}
                                  onChange={() => toggleSectionSelection(g.id, p.studentId)}
                                  className="accent-mega-navy"
                                />
                                <span className="text-slate-700">{p.studentName}</span>
                              </span>
                              <span className="text-xs text-slate-400">
                                {p.sectionName ? `Section ${p.sectionName}` : "No section"}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={sectionPick[g.id] || ""}
                            onChange={(e) => setSectionPick({ ...sectionPick, [g.id]: e.target.value })}
                            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-mega-blue"
                          >
                            <option value="">Assign to section...</option>
                            {sectionsByGrade(g.id)
                              .filter((s) => s.isActive)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => assignSectionsForGrade(g.id)}
                            disabled={saving || selected.size === 0 || !sectionPick[g.id]}
                            className="bg-mega-navy text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
                          >
                            Assign {selected.size || ""}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

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
