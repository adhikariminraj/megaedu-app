"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MeetingActions, { MeetingActionRow } from "@/components/MeetingActions";

type Evaluation = {
  id: string;
  teacherId: string;
  teacherName: string;
  remarks: string;
  visibleToParent: boolean;
  visibleToStudent: boolean;
};
type RosterRow = {
  studentId: string;
  studentName: string;
  sectionName: string | null;
  evaluations: Evaluation[];
  meetings: MeetingActionRow[];
};
type GradeOption = { id: string; displayName: string; wholeGradeAllowed: boolean; sections: { id: string; name: string }[] };

export default function EvaluationsClient({
  schoolId,
  isAdmin,
  myTeacherId,
  classTeacherOptions,
  gradeOptions,
  selectedGradeId,
  selectedSectionId,
  roster,
  basePath = "/dashboard/evaluations",
}: {
  schoolId: string;
  isAdmin: boolean;
  myTeacherId: string | null;
  classTeacherOptions: { id: string; name: string }[];
  gradeOptions: GradeOption[];
  selectedGradeId: string;
  selectedSectionId: string | null;
  roster: RosterRow[];
  // Phase 4D-3: the unscoped legacy page keeps its default; the
  // schoolId-scoped page passes its own path so filter changes stay
  // scoped instead of bouncing back to the unscoped route.
  basePath?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newFor, setNewFor] = useState<string | null>(null);
  const [newRemarks, setNewRemarks] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedGrade = gradeOptions.find((g) => g.id === selectedGradeId)!;

  function navigate(gradeId: string, sectionId: string | null) {
    const qs = new URLSearchParams();
    qs.set("grade", gradeId);
    if (sectionId) qs.set("section", sectionId);
    router.push(`${basePath}?${qs.toString()}`);
  }

  async function call(url: string, options: RequestInit) {
    setError(null);
    setBusy(true);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return body;
  }

  async function addEvaluation(studentId: string) {
    if (!newRemarks.trim()) {
      setError("Enter remarks first.");
      return;
    }
    if (isAdmin && !newTeacherId) {
      setError("Select which teacher this evaluation is attributed to.");
      return;
    }
    const ok = await call(`/api/schools/${schoolId}/students/${studentId}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        remarks: newRemarks,
        ...(isAdmin ? { teacherId: newTeacherId } : {}),
      }),
    });
    if (ok) {
      setNewFor(null);
      setNewRemarks("");
      setNewTeacherId("");
    }
  }

  async function saveEdit(evaluationId: string) {
    if (!editRemarks.trim()) return;
    const ok = await call(`/api/schools/${schoolId}/evaluations/${evaluationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remarks: editRemarks }),
    });
    if (ok) setEditingId(null);
  }

  async function share(evaluationId: string, audience: "PARENT" | "STUDENT") {
    await call(`/api/schools/${schoolId}/evaluations/${evaluationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share: audience }),
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">General Student Evaluation</h1>
      <p className="text-sm text-slate-500 mb-6">
        Overall development remarks from the Grade Coordinator or Class Teacher — separate from any
        subject-specific evaluation, which lives on that subject's own page.
      </p>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={selectedGradeId}
          onChange={(e) => navigate(e.target.value, null)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          {gradeOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.displayName}
            </option>
          ))}
        </select>
        {selectedGrade.sections.length > 0 && (
          <select
            value={selectedSectionId ?? ""}
            onChange={(e) => navigate(selectedGradeId, e.target.value || null)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {selectedGrade.wholeGradeAllowed && <option value="">Whole grade</option>}
            {selectedGrade.sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {roster.length === 0 ? (
        <p className="text-slate-400 text-sm">No students placed here yet.</p>
      ) : (
        <div className="space-y-4">
          {roster.map((r) => {
            const canAddMore = isAdmin || !r.evaluations.some((ev) => ev.teacherId === myTeacherId);
            return (
              <div key={r.studentId} className="border border-slate-200 rounded-xl p-4">
                <p className="font-medium text-slate-800 mb-2">
                  {r.studentName}
                  {r.sectionName ? <span className="text-slate-400 text-sm"> — Section {r.sectionName}</span> : null}
                </p>

                {r.evaluations.length === 0 && (
                  <p className="text-sm text-slate-400 mb-2">No general evaluation yet.</p>
                )}

                <div className="space-y-2">
                  {r.evaluations.map((ev) => {
                    const mine = isAdmin || ev.teacherId === myTeacherId;
                    return (
                      <div key={ev.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                        <p className="text-xs text-slate-400 mb-1">
                          By {ev.teacherName}
                          {ev.visibleToParent && <span className="ml-2 text-mega-green">Shared with parent</span>}
                          {ev.visibleToStudent && <span className="ml-2 text-mega-blue">Shared with student</span>}
                        </p>
                        {editingId === ev.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editRemarks}
                              onChange={(e) => setEditRemarks(e.target.value)}
                              rows={3}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(ev.id)}
                                disabled={busy}
                                className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-slate-700 whitespace-pre-wrap">{ev.remarks}</p>
                            {mine && (
                              <div className="flex gap-3 mt-2">
                                <button
                                  onClick={() => {
                                    setEditingId(ev.id);
                                    setEditRemarks(ev.remarks);
                                  }}
                                  className="text-xs text-mega-blue font-medium"
                                >
                                  Edit
                                </button>
                                {!ev.visibleToParent && (
                                  <button
                                    onClick={() => share(ev.id, "PARENT")}
                                    disabled={busy}
                                    className="text-xs text-mega-green font-medium disabled:opacity-50"
                                  >
                                    Share with Parent
                                  </button>
                                )}
                                {!ev.visibleToStudent && (
                                  <button
                                    onClick={() => share(ev.id, "STUDENT")}
                                    disabled={busy}
                                    className="text-xs text-mega-navy font-medium disabled:opacity-50"
                                  >
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
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {newFor === r.studentId ? (
                      <div className="space-y-2">
                        {isAdmin && (
                          <select
                            value={newTeacherId}
                            onChange={(e) => setNewTeacherId(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">Attribute to teacher...</option>
                            {classTeacherOptions.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <textarea
                          value={newRemarks}
                          onChange={(e) => setNewRemarks(e.target.value)}
                          rows={3}
                          placeholder="Overall development, behavior, effort, participation..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => addEvaluation(r.studentId)}
                            disabled={busy}
                            className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5 disabled:opacity-50"
                          >
                            Save Evaluation
                          </button>
                          <button onClick={() => setNewFor(null)} className="text-xs text-slate-500">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewFor(r.studentId)}
                        className="text-xs text-mega-blue font-medium"
                      >
                        + Add Evaluation
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Parent-Teacher Meetings</p>
                  <MeetingActions
                    schoolId={schoolId}
                    studentId={r.studentId}
                    meetings={r.meetings}
                    evaluations={r.evaluations}
                    isAdmin={isAdmin}
                    myTeacherId={myTeacherId}
                    teacherOptions={classTeacherOptions}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
