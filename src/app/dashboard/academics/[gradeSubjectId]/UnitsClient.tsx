"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MeetingActions, { MeetingActionRow } from "@/components/MeetingActions";

const UNIT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
const RESULT_STATUSES = ["PENDING", "EVALUATED", "ABSENT"] as const;

type Result = {
  studentId: string;
  studentName: string;
  status: string;
  marksObtained: number | null;
  remarks: string | null;
};
type Test = { id: string; title: string; testDate: string; maxMarks: number; results: Result[] };
type Unit = { id: string; title: string; order: number; status: string; tests: Test[] };
type Plan = { plannedTotal: number; unitLabel: string } | null;
type StudentEval = {
  id: string;
  teacherId: string;
  teacherName: string;
  remarks: string;
  visibleToParent: boolean;
  visibleToStudent: boolean;
};
type EvalRosterRow = {
  studentId: string;
  studentName: string;
  evaluations: StudentEval[];
  meetings: MeetingActionRow[];
};

export default function UnitsClient({
  schoolId,
  schoolGradeId,
  gradeSubjectId,
  gradeDisplayName,
  subjectName,
  sessionName,
  sections,
  selectedSectionId,
  canEdit,
  isAdmin,
  myTeacherId,
  subjectTeacherOptions,
  evaluationRoster,
  plan,
  units,
}: {
  schoolId: string;
  schoolGradeId: string;
  gradeSubjectId: string;
  gradeDisplayName: string;
  subjectName: string;
  sessionName: string;
  sections: { id: string; name: string }[];
  selectedSectionId: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  myTeacherId: string | null;
  subjectTeacherOptions: { id: string; name: string }[];
  evaluationRoster: EvalRosterRow[];
  plan: Plan;
  units: Unit[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ plannedTotal: plan?.plannedTotal.toString() ?? "", unitLabel: plan?.unitLabel ?? "Unit" });
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [testForm, setTestForm] = useState<Record<string, { title: string; testDate: string; maxMarks: string }>>({});
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [evalDrafts, setEvalDrafts] = useState<Record<string, { status: string; marksObtained: string; remarks: string }>>({});
  const [newEvalFor, setNewEvalFor] = useState<string | null>(null);
  const [newEvalRemarks, setNewEvalRemarks] = useState("");
  const [newEvalTeacherId, setNewEvalTeacherId] = useState("");
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);
  const [editEvalRemarks, setEditEvalRemarks] = useState("");

  async function call(url: string, options: RequestInit) {
    setError(null);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return body;
  }

  function navigateSection(sectionId: string) {
    const qs = sectionId ? `?section=${sectionId}` : "";
    router.push(`/dashboard/academics/${gradeSubjectId}${qs}`);
  }

  async function savePlan() {
    const total = parseInt(planForm.plannedTotal, 10);
    if (!Number.isInteger(total) || total < 1) {
      setError("Enter a planned total of at least 1.");
      return;
    }
    await call(`/api/schools/${schoolId}/grades/${schoolGradeId}/subjects/${gradeSubjectId}/teaching-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: selectedSectionId, plannedTotal: total, unitLabel: planForm.unitLabel }),
    });
  }

  async function addUnit() {
    if (!newUnitTitle.trim()) return;
    const result = await call(`/api/schools/${schoolId}/grades/${schoolGradeId}/subjects/${gradeSubjectId}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: selectedSectionId, title: newUnitTitle.trim() }),
    });
    if (result) setNewUnitTitle("");
  }

  async function updateUnitStatus(unitId: string, status: string) {
    await call(`/api/schools/${schoolId}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function createTest(unitId: string) {
    const f = testForm[unitId];
    if (!f?.title?.trim() || !f?.testDate || !f?.maxMarks) return;
    const result = await call(`/api/schools/${schoolId}/units/${unitId}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.title.trim(), testDate: f.testDate, maxMarks: parseInt(f.maxMarks, 10) }),
    });
    if (result) setTestForm((p) => ({ ...p, [unitId]: { title: "", testDate: "", maxMarks: "" } }));
  }

  async function saveResult(testId: string, studentId: string) {
    const key = `${testId}:${studentId}`;
    const d = evalDrafts[key];
    if (!d) return;
    await call(`/api/schools/${schoolId}/tests/${testId}/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: [
          {
            studentId,
            status: d.status,
            marksObtained: d.status === "EVALUATED" ? parseFloat(d.marksObtained) : undefined,
            remarks: d.remarks || undefined,
          },
        ],
      }),
    });
  }

  async function addSubjectEvaluation(studentId: string) {
    if (!newEvalRemarks.trim()) {
      setError("Enter remarks first.");
      return;
    }
    if (isAdmin && !newEvalTeacherId) {
      setError("Select which teacher this evaluation is attributed to.");
      return;
    }
    const result = await call(`/api/schools/${schoolId}/students/${studentId}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        remarks: newEvalRemarks,
        gradeSubjectId,
        ...(isAdmin ? { teacherId: newEvalTeacherId } : {}),
      }),
    });
    if (result) {
      setNewEvalFor(null);
      setNewEvalRemarks("");
      setNewEvalTeacherId("");
    }
  }

  async function saveEvalEdit(evaluationId: string) {
    if (!editEvalRemarks.trim()) return;
    const result = await call(`/api/schools/${schoolId}/evaluations/${evaluationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remarks: editEvalRemarks }),
    });
    if (result) setEditingEvalId(null);
  }

  async function shareEval(evaluationId: string, audience: "PARENT" | "STUDENT") {
    await call(`/api/schools/${schoolId}/evaluations/${evaluationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share: audience }),
    });
  }

  const totalUnits = units.length;
  const completed = units.filter((u) => u.status === "COMPLETED").length;
  const inProgress = units.filter((u) => u.status === "IN_PROGRESS").length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/dashboard/academics" className="text-xs text-mega-blue">
        ← Subjects &amp; Teacher Assignments
      </Link>
      <p className="text-sm text-slate-400 mt-2 mb-1">{sessionName}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {gradeDisplayName} — {subjectName}
      </h1>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {sections.length > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => navigateSection("")}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 ${!selectedSectionId ? "bg-mega-navy text-white" : "bg-blue-50 text-mega-navy"}`}
          >
            All sections
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => navigateSection(s.id)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 ${selectedSectionId === s.id ? "bg-mega-navy text-white" : "bg-blue-50 text-mega-navy"}`}
            >
              Section {s.name}
            </button>
          ))}
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Read-only — you're not assigned to teach this subject for this scope.
        </p>
      )}

      <div className="border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Teaching Plan</h2>
        {plan ? (
          <p className="text-sm text-slate-600 mb-2">
            Planned total: <strong>{plan.plannedTotal}</strong> {plan.unitLabel}
            {plan.plannedTotal === 1 ? "" : "s"} — {completed} completed, {inProgress} in progress,{" "}
            {totalUnits} created ({Math.round((completed / plan.plannedTotal) * 100)}% of plan complete)
          </p>
        ) : (
          <p className="text-sm text-slate-400 mb-2">
            No plan set — {totalUnits} {totalUnits === 1 ? "unit" : "units"} created, {completed} completed,{" "}
            {inProgress} in progress.
          </p>
        )}
        {canEdit && (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              min={1}
              value={planForm.plannedTotal}
              onChange={(e) => setPlanForm((p) => ({ ...p, plannedTotal: e.target.value }))}
              placeholder="Planned total"
              className="w-32 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
            />
            <input
              value={planForm.unitLabel}
              onChange={(e) => setPlanForm((p) => ({ ...p, unitLabel: e.target.value }))}
              placeholder="Unit / Chapter"
              className="w-32 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
            />
            <button onClick={savePlan} className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5">
              Save Plan
            </button>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-3">{plan?.unitLabel ?? "Unit"}s</h2>
      {units.length === 0 ? (
        <p className="text-slate-400 text-sm mb-4">None created yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {units.map((u) => {
            const expanded = expandedUnitId === u.id;
            return (
              <div key={u.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setExpandedUnitId(expanded ? null : u.id)} className="text-left flex-1">
                    <span className="text-sm font-medium text-slate-800">
                      {u.order}. {u.title}
                    </span>
                  </button>
                  {canEdit ? (
                    <select
                      value={u.status}
                      onChange={(e) => updateUnitStatus(u.id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                    >
                      {UNIT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-mega-navy">
                      {u.status.replace("_", " ")}
                    </span>
                  )}
                </div>

                {expanded && (
                  <div className="mt-3 pl-3 border-l-2 border-slate-100 space-y-3">
                    {u.tests.length === 0 ? (
                      <p className="text-xs text-slate-400">No tests yet.</p>
                    ) : (
                      u.tests.map((t) => {
                        const pending = t.results.filter((r) => r.status === "PENDING").length;
                        const evaluated = t.results.filter((r) => r.status === "EVALUATED").length;
                        const absent = t.results.filter((r) => r.status === "ABSENT").length;
                        const testExpanded = expandedTestId === t.id;
                        return (
                          <div key={t.id} className="border border-slate-100 rounded-lg p-2">
                            <button
                              onClick={() => setExpandedTestId(testExpanded ? null : t.id)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs font-medium text-slate-700">
                                {t.title} — {t.testDate} — /{t.maxMarks}
                              </span>
                              <span className="text-xs text-slate-400">
                                {evaluated} evaluated · {absent} absent · {pending} pending
                              </span>
                            </button>
                            {testExpanded && (
                              <div className="mt-2 space-y-1">
                                {t.results.map((r) => {
                                  const key = `${t.id}:${r.studentId}`;
                                  const draft = evalDrafts[key] ?? {
                                    status: r.status,
                                    marksObtained: r.marksObtained?.toString() ?? "",
                                    remarks: r.remarks ?? "",
                                  };
                                  return (
                                    <div key={r.studentId} className="flex items-center gap-2 text-xs">
                                      <span className="w-32 shrink-0">{r.studentName}</span>
                                      {canEdit ? (
                                        <>
                                          <select
                                            value={draft.status}
                                            onChange={(e) =>
                                              setEvalDrafts((p) => ({ ...p, [key]: { ...draft, status: e.target.value } }))
                                            }
                                            className="border border-slate-200 rounded px-1 py-0.5"
                                          >
                                            {RESULT_STATUSES.map((s) => (
                                              <option key={s} value={s}>
                                                {s}
                                              </option>
                                            ))}
                                          </select>
                                          {draft.status === "EVALUATED" && (
                                            <input
                                              type="number"
                                              value={draft.marksObtained}
                                              onChange={(e) =>
                                                setEvalDrafts((p) => ({ ...p, [key]: { ...draft, marksObtained: e.target.value } }))
                                              }
                                              placeholder="Marks"
                                              className="w-16 border border-slate-200 rounded px-1 py-0.5"
                                            />
                                          )}
                                          <input
                                            value={draft.remarks}
                                            onChange={(e) => setEvalDrafts((p) => ({ ...p, [key]: { ...draft, remarks: e.target.value } }))}
                                            placeholder="Remarks"
                                            className="flex-1 border border-slate-200 rounded px-1 py-0.5"
                                          />
                                          <button
                                            onClick={() => saveResult(t.id, r.studentId)}
                                            className="text-mega-navy font-semibold"
                                          >
                                            Save
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-slate-500">
                                          {r.status}
                                          {r.marksObtained !== null ? ` — ${r.marksObtained}/${t.maxMarks}` : ""}
                                          {r.remarks ? ` — ${r.remarks}` : ""}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {canEdit && u.status !== "NOT_STARTED" && (
                      <div className="flex gap-2">
                        <input
                          value={testForm[u.id]?.title ?? ""}
                          onChange={(e) => setTestForm((p) => ({ ...p, [u.id]: { ...(p[u.id] ?? { testDate: "", maxMarks: "" }), title: e.target.value } }))}
                          placeholder="Test title"
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1"
                        />
                        <input
                          type="date"
                          value={testForm[u.id]?.testDate ?? ""}
                          onChange={(e) => setTestForm((p) => ({ ...p, [u.id]: { ...(p[u.id] ?? { title: "", maxMarks: "" }), testDate: e.target.value } }))}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                        />
                        <input
                          type="number"
                          value={testForm[u.id]?.maxMarks ?? ""}
                          onChange={(e) => setTestForm((p) => ({ ...p, [u.id]: { ...(p[u.id] ?? { title: "", testDate: "" }), maxMarks: e.target.value } }))}
                          placeholder="Max marks"
                          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1"
                        />
                        <button
                          onClick={() => createTest(u.id)}
                          className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1"
                        >
                          Create Test
                        </button>
                      </div>
                    )}
                    {canEdit && u.status === "NOT_STARTED" && (
                      <p className="text-xs text-slate-400">
                        Mark this {plan?.unitLabel?.toLowerCase() ?? "unit"} In Progress before creating a test.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <input
            value={newUnitTitle}
            onChange={(e) => setNewUnitTitle(e.target.value)}
            placeholder={`e.g. ${plan?.unitLabel ?? "Unit"} ${units.length + 1}: ...`}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <button onClick={addUnit} className="text-sm font-semibold text-white bg-mega-navy rounded-lg px-4 py-2">
            Add {plan?.unitLabel ?? "Unit"}
          </button>
        </div>
      )}

      <div className="mt-10 pt-8 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Subject Evaluations</h2>
        <p className="text-xs text-slate-400 mb-4">
          Qualitative remarks on this student's development in {subjectName} — separate from Unit/Chapter
          Test marks above.
        </p>
        {evaluationRoster.length === 0 ? (
          <p className="text-slate-400 text-sm">No students placed here yet.</p>
        ) : (
          <div className="space-y-3">
            {evaluationRoster.map((r) => {
              const canAddMore = canEdit && (isAdmin || !r.evaluations.some((ev) => ev.teacherId === myTeacherId));
              return (
                <div key={r.studentId} className="border border-slate-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-slate-800 mb-2">{r.studentName}</p>
                  {r.evaluations.length === 0 && (
                    <p className="text-xs text-slate-400 mb-2">No subject evaluation yet.</p>
                  )}
                  <div className="space-y-2">
                    {r.evaluations.map((ev) => {
                      const mine = canEdit && (isAdmin || ev.teacherId === myTeacherId);
                      return (
                        <div key={ev.id} className="border border-slate-100 rounded-lg p-2 text-xs">
                          <p className="text-slate-400 mb-1">
                            By {ev.teacherName}
                            {ev.visibleToParent && <span className="ml-2 text-mega-green">Shared with parent</span>}
                            {ev.visibleToStudent && <span className="ml-2 text-mega-navy">Shared with student</span>}
                          </p>
                          {editingEvalId === ev.id ? (
                            <div className="space-y-1">
                              <textarea
                                value={editEvalRemarks}
                                onChange={(e) => setEditEvalRemarks(e.target.value)}
                                rows={2}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => saveEvalEdit(ev.id)} className="text-mega-navy font-semibold">
                                  Save
                                </button>
                                <button onClick={() => setEditingEvalId(null)} className="text-slate-500">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-slate-700 whitespace-pre-wrap">{ev.remarks}</p>
                              {mine && (
                                <div className="flex gap-3 mt-1">
                                  <button
                                    onClick={() => {
                                      setEditingEvalId(ev.id);
                                      setEditEvalRemarks(ev.remarks);
                                    }}
                                    className="text-mega-blue font-medium"
                                  >
                                    Edit
                                  </button>
                                  {!ev.visibleToParent && (
                                    <button onClick={() => shareEval(ev.id, "PARENT")} className="text-mega-green font-medium">
                                      Share with Parent
                                    </button>
                                  )}
                                  {!ev.visibleToStudent && (
                                    <button onClick={() => shareEval(ev.id, "STUDENT")} className="text-mega-navy font-medium">
                                      Share with Student
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canAddMore && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      {newEvalFor === r.studentId ? (
                        <div className="space-y-1">
                          {isAdmin && (
                            <select
                              value={newEvalTeacherId}
                              onChange={(e) => setNewEvalTeacherId(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
                            >
                              <option value="">Attribute to teacher...</option>
                              {subjectTeacherOptions.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <textarea
                            value={newEvalRemarks}
                            onChange={(e) => setNewEvalRemarks(e.target.value)}
                            rows={2}
                            placeholder={`Development in ${subjectName}...`}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => addSubjectEvaluation(r.studentId)}
                              className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1"
                            >
                              Save Evaluation
                            </button>
                            <button onClick={() => setNewEvalFor(null)} className="text-xs text-slate-500">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setNewEvalFor(r.studentId)} className="text-xs text-mega-blue font-medium">
                          + Add Evaluation
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Parent-Teacher Meetings</p>
                    <MeetingActions
                      schoolId={schoolId}
                      studentId={r.studentId}
                      gradeSubjectId={gradeSubjectId}
                      meetings={r.meetings}
                      evaluations={r.evaluations}
                      isAdmin={isAdmin}
                      myTeacherId={myTeacherId}
                      teacherOptions={subjectTeacherOptions}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
