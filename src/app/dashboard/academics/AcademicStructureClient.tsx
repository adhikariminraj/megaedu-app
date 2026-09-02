"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Subject = { id: string; name: string; isActive: boolean };
type OfferedSubject = { id: string; subjectId: string; subjectName: string };
type Assignment = {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  sectionId: string | null;
  sectionName: string | null;
};
type ClassTeacher = {
  id: string;
  teacherId: string;
  teacherName: string;
  sectionId: string | null;
  sectionName: string | null;
};
type SectionRow = { id: string; name: string; isActive: boolean };
type Grade = {
  id: string;
  displayName: string;
  sections: SectionRow[];
  offeredSubjects: OfferedSubject[];
  assignments: Assignment[];
  classTeachers: ClassTeacher[];
};
type Teacher = { id: string; name: string };

export default function AcademicStructureClient({
  schoolId,
  schoolName,
  activeSession,
  subjects,
  grades,
  teachers,
}: {
  schoolId: string;
  schoolName: string;
  activeSession: { id: string; name: string } | null;
  subjects: Subject[];
  grades: Grade[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newSubjectNames, setNewSubjectNames] = useState("");
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [expandedGradeId, setExpandedGradeId] = useState<string | null>(null);
  const [addSubjectPick, setAddSubjectPick] = useState<Record<string, string>>({});
  const [assignPick, setAssignPick] = useState<
    Record<string, { teacherId: string; subjectId: string; sectionId: string }>
  >({});
  const [classTeacherPick, setClassTeacherPick] = useState<Record<string, { teacherId: string; sectionId: string }>>({});
  const [newSectionNames, setNewSectionNames] = useState<Record<string, string>>({});
  const [sectionRenaming, setSectionRenaming] = useState<Record<string, string>>({});
  const [confirmDeactivateSectionId, setConfirmDeactivateSectionId] = useState<string | null>(null);

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

  async function addSubjects() {
    const names = newSubjectNames
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const result = await call(`/api/schools/${schoolId}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    if (result) setNewSubjectNames("");
  }

  async function toggleSubjectActive(subject: Subject) {
    await call(`/api/schools/${schoolId}/subjects/${subject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !subject.isActive }),
    });
  }

  async function renameSubject(subjectId: string) {
    const name = renaming[subjectId];
    if (!name?.trim()) return;
    const result = await call(`/api/schools/${schoolId}/subjects/${subjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (result) setRenaming((r) => ({ ...r, [subjectId]: "" }));
  }

  async function offerSubject(gradeId: string) {
    const subjectId = addSubjectPick[gradeId];
    if (!subjectId || !activeSession) return;
    const result = await call(`/api/schools/${schoolId}/grades/${gradeId}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicSessionId: activeSession.id, subjectIds: [subjectId] }),
    });
    if (result?.created === 0) {
      setError("That subject is already offered at this grade this session.");
    }
    setAddSubjectPick((p) => ({ ...p, [gradeId]: "" }));
  }

  async function removeOffering(gradeId: string, gradeSubjectId: string) {
    await call(`/api/schools/${schoolId}/grades/${gradeId}/subjects/${gradeSubjectId}`, {
      method: "DELETE",
    });
  }

  async function assignTeacher(gradeId: string) {
    const pick = assignPick[gradeId];
    if (!pick?.teacherId || !pick?.subjectId || !activeSession) return;
    const result = await call(`/api/schools/${schoolId}/teacher-academic-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicSessionId: activeSession.id,
        assignments: [
          {
            teacherId: pick.teacherId,
            schoolGradeId: gradeId,
            subjectId: pick.subjectId,
            sectionId: pick.sectionId || null,
          },
        ],
      }),
    });
    if (result?.created === 0) {
      setError(
        pick.sectionId
          ? "That teacher already has a grade-wide assignment for this subject, which already covers this section."
          : "That teacher already has an assignment for this subject at this grade — remove the existing one(s) first, or this would overlap."
      );
    }
    setAssignPick((p) => ({ ...p, [gradeId]: { teacherId: "", subjectId: "", sectionId: "" } }));
  }

  async function removeAssignment(assignmentId: string) {
    await call(`/api/schools/${schoolId}/teacher-academic-assignments/${assignmentId}`, {
      method: "DELETE",
    });
  }

  async function assignClassTeacher(gradeId: string) {
    const pick = classTeacherPick[gradeId];
    if (!pick?.teacherId || !activeSession) return;
    const result = await call(`/api/schools/${schoolId}/class-teacher-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicSessionId: activeSession.id,
        assignments: [{ teacherId: pick.teacherId, schoolGradeId: gradeId, sectionId: pick.sectionId || null }],
      }),
    });
    if (result?.created === 0) {
      setError(
        pick.sectionId
          ? "That section already has a Class Teacher — remove the existing one first."
          : "This grade already has a Grade Coordinator — remove the existing one first."
      );
    }
    setClassTeacherPick((p) => ({ ...p, [gradeId]: { teacherId: "", sectionId: "" } }));
  }

  async function removeClassTeacher(assignmentId: string) {
    await call(`/api/schools/${schoolId}/class-teacher-assignments/${assignmentId}`, {
      method: "DELETE",
    });
  }

  async function addSections(gradeId: string) {
    const names = (newSectionNames[gradeId] || "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const result = await call(`/api/schools/${schoolId}/grades/${gradeId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    if (result) setNewSectionNames((p) => ({ ...p, [gradeId]: "" }));
  }

  async function renameSection(sectionId: string) {
    const name = sectionRenaming[sectionId];
    if (!name?.trim()) return;
    const result = await call(`/api/schools/${schoolId}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    // Clear the key entirely (not just to "") so the input falls back to
    // the freshly-saved s.name via `??` instead of showing blank — "" is
    // not nullish, so it would otherwise win over the real value.
    if (result) {
      setSectionRenaming((r) => {
        const { [sectionId]: _, ...rest } = r;
        return rest;
      });
    }
  }

  async function toggleSectionActive(section: SectionRow) {
    await call(`/api/schools/${schoolId}/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !section.isActive }),
    });
    setConfirmDeactivateSectionId(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{schoolName}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Subjects &amp; Teacher Assignments</h1>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Subject Catalog</h2>
        <p className="text-xs text-slate-400 mb-4">
          School-wide — reusable across every grade and academic session. Deactivating a subject
          hides it from new grade offerings and assignments without touching anything that already
          references it.
        </p>

        {subjects.length === 0 ? (
          <p className="text-slate-400 text-sm mb-4">No subjects yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 border border-slate-100 rounded-lg px-3 py-2"
              >
                <input
                  value={renaming[s.id] ?? s.name}
                  onChange={(e) => setRenaming((r) => ({ ...r, [s.id]: e.target.value }))}
                  className="flex-1 text-sm border border-slate-200 rounded px-2 py-1"
                />
                {renaming[s.id] !== undefined && renaming[s.id] !== s.name && (
                  <button
                    onClick={() => renameSubject(s.id)}
                    className="text-xs font-semibold text-mega-navy"
                  >
                    Save
                  </button>
                )}
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    s.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => toggleSubjectActive(s)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {s.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newSubjectNames}
            onChange={(e) => setNewSubjectNames(e.target.value)}
            placeholder="e.g. Mathematics, Science, English"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <button
            onClick={addSubjects}
            className="text-sm font-semibold text-white bg-mega-navy rounded-lg px-4 py-2"
          >
            Add
          </button>
        </div>
      </div>

      {!activeSession ? (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          No active academic session yet.{" "}
          <Link href="/dashboard/setup" className="underline font-medium">
            Complete Initial Setup
          </Link>{" "}
          before configuring grade subjects and teacher assignments.
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            Grade Subjects &amp; Teacher Assignments
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {activeSession.name} — offerings and assignments are specific to this session and are
            never carried forward automatically. Open a grade to configure it.
          </p>

          <div className="space-y-3">
            {grades.map((g) => {
              const expanded = expandedGradeId === g.id;
              const activeSubjects = subjects.filter((s) => s.isActive);
              const notYetOffered = activeSubjects.filter(
                (s) => !g.offeredSubjects.some((o) => o.subjectId === s.id)
              );
              const pick = assignPick[g.id] || { teacherId: "", subjectId: "", sectionId: "" };
              // Deactivated sections stay visible in the management list
              // below, but are excluded from every "pick a section to
              // assign someone to" dropdown — deactivating one is
              // specifically meant to stop new assignments against it.
              const activeSections = g.sections.filter((s) => s.isActive);

              return (
                <div key={g.id} className="border border-slate-200 rounded-xl p-4">
                  <button
                    onClick={() => setExpandedGradeId(expanded ? null : g.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span className="font-medium text-slate-800">{g.displayName}</span>
                    <span className="text-xs text-slate-400">
                      {g.offeredSubjects.length} subject{g.offeredSubjects.length === 1 ? "" : "s"} ·{" "}
                      {g.assignments.length} assignment{g.assignments.length === 1 ? "" : "s"}
                    </span>
                  </button>

                  {expanded && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">Sections</p>
                        <p className="text-xs text-slate-400 mb-2">
                          Needed before a teacher can be assigned to an individual section rather
                          than the whole grade. No fixed maximum — add as many as this grade uses.
                          Deactivating a section stops it being offered for new assignments or
                          placements — every student, teacher assignment, attendance record, and
                          evaluation already linked to it is preserved untouched, and it can be
                          reactivated at any time.
                        </p>
                        {g.sections.length === 0 ? (
                          <p className="text-slate-400 text-xs mb-2">None yet — only "All sections" is available until you add some.</p>
                        ) : (
                          <div className="space-y-1.5 mb-2">
                            {g.sections.map((s) => {
                              const confirming = confirmDeactivateSectionId === s.id;
                              return (
                                <div
                                  key={s.id}
                                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                                    s.isActive ? "border-slate-100" : "border-slate-100 bg-slate-50"
                                  }`}
                                >
                                  <span className="text-xs font-medium text-slate-400 shrink-0">Section</span>
                                  <input
                                    value={sectionRenaming[s.id] ?? s.name}
                                    onChange={(e) =>
                                      setSectionRenaming((r) => ({ ...r, [s.id]: e.target.value }))
                                    }
                                    className={`flex-1 min-w-0 text-sm border border-slate-200 rounded px-2 py-1 ${
                                      s.isActive ? "" : "text-slate-400"
                                    }`}
                                  />
                                  {sectionRenaming[s.id] !== undefined && sectionRenaming[s.id] !== s.name && (
                                    <button
                                      onClick={() => renameSection(s.id)}
                                      className="text-xs font-semibold text-mega-navy shrink-0"
                                    >
                                      Save
                                    </button>
                                  )}
                                  <span
                                    className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                                      s.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {s.isActive ? "Active" : "Inactive"}
                                  </span>
                                  {confirming ? (
                                    <span className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-mega-red">Deactivate?</span>
                                      <button
                                        onClick={() => toggleSectionActive(s)}
                                        className="text-xs font-semibold text-mega-red hover:text-red-700"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeactivateSectionId(null)}
                                        className="text-xs text-slate-400 hover:text-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        s.isActive
                                          ? setConfirmDeactivateSectionId(s.id)
                                          : toggleSectionActive(s)
                                      }
                                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 shrink-0"
                                    >
                                      {s.isActive ? "Deactivate" : "Reactivate"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            value={newSectionNames[g.id] || ""}
                            onChange={(e) => setNewSectionNames((p) => ({ ...p, [g.id]: e.target.value }))}
                            placeholder="Label only, e.g. A, B, C — not &quot;Section C&quot;"
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5"
                          />
                          <button
                            onClick={() => addSections(g.id)}
                            className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">
                          Grade Coordinators &amp; Class Teachers
                        </p>
                        <p className="text-xs text-slate-400 mb-2">
                          A Grade Coordinator covers every section; a Class Teacher covers only
                          their own section. Both are responsibilities, not separate teacher types —
                          the same teacher may hold either alongside their subject teaching
                          assignments, and both may coexist for the same grade.
                        </p>
                        {g.classTeachers.length === 0 ? (
                          <p className="text-slate-400 text-xs mb-2">None assigned yet.</p>
                        ) : (
                          <div className="space-y-1 mb-2">
                            {g.classTeachers.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2"
                              >
                                <span>
                                  {c.teacherName} —{" "}
                                  <span className="text-slate-400">
                                    {c.sectionName ? `Class Teacher — Section ${c.sectionName}` : "Grade Coordinator"}
                                  </span>
                                </span>
                                <button
                                  onClick={() => removeClassTeacher(c.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <select
                            value={classTeacherPick[g.id]?.teacherId || ""}
                            onChange={(e) =>
                              setClassTeacherPick((p) => ({
                                ...p,
                                [g.id]: { teacherId: e.target.value, sectionId: p[g.id]?.sectionId || "" },
                              }))
                            }
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                          >
                            <option value="">Teacher...</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={classTeacherPick[g.id]?.sectionId || ""}
                            onChange={(e) =>
                              setClassTeacherPick((p) => ({
                                ...p,
                                [g.id]: { teacherId: p[g.id]?.teacherId || "", sectionId: e.target.value },
                              }))
                            }
                            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                          >
                            <option value="">Whole grade (Grade Coordinator)</option>
                            {activeSections.map((s) => (
                              <option key={s.id} value={s.id}>
                                Section {s.name} (Class Teacher)
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignClassTeacher(g.id)}
                            className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5"
                          >
                            Assign
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">
                          Subjects offered this session
                        </p>
                        {g.offeredSubjects.length === 0 ? (
                          <p className="text-slate-400 text-xs mb-2">None yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {g.offeredSubjects.map((o) => (
                              <span
                                key={o.id}
                                className="text-xs bg-blue-50 text-mega-navy rounded-full px-3 py-1 flex items-center gap-2"
                              >
                                <Link href={`/dashboard/academics/${o.id}`} className="hover:underline">
                                  {o.subjectName}
                                </Link>
                                <button
                                  onClick={() => removeOffering(g.id, o.id)}
                                  className="text-mega-navy/60 hover:text-mega-navy"
                                  title="Remove from this session's offering"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {notYetOffered.length > 0 && (
                          <div className="flex gap-2">
                            <select
                              value={addSubjectPick[g.id] || ""}
                              onChange={(e) =>
                                setAddSubjectPick((p) => ({ ...p, [g.id]: e.target.value }))
                              }
                              className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="">Select a subject...</option>
                              {notYetOffered.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => offerSubject(g.id)}
                              className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5"
                            >
                              Offer
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">
                          Teacher assignments
                        </p>
                        {g.assignments.length === 0 ? (
                          <p className="text-slate-400 text-xs mb-2">None yet.</p>
                        ) : (
                          <div className="space-y-1 mb-2">
                            {g.assignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2"
                              >
                                <span>
                                  {a.teacherName} — {a.subjectName} —{" "}
                                  <span className="text-slate-400">
                                    {a.sectionName ? `Section ${a.sectionName}` : "All sections"}
                                  </span>
                                </span>
                                <button
                                  onClick={() => removeAssignment(a.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {g.offeredSubjects.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              value={pick.teacherId}
                              onChange={(e) =>
                                setAssignPick((p) => ({
                                  ...p,
                                  [g.id]: { ...pick, teacherId: e.target.value },
                                }))
                              }
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="">Teacher...</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={pick.subjectId}
                              onChange={(e) =>
                                setAssignPick((p) => ({
                                  ...p,
                                  [g.id]: { ...pick, subjectId: e.target.value },
                                }))
                              }
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="">Subject...</option>
                              {g.offeredSubjects.map((o) => (
                                <option key={o.subjectId} value={o.subjectId}>
                                  {o.subjectName}
                                </option>
                              ))}
                            </select>
                            <select
                              value={pick.sectionId}
                              onChange={(e) =>
                                setAssignPick((p) => ({
                                  ...p,
                                  [g.id]: { ...pick, sectionId: e.target.value },
                                }))
                              }
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="">All sections</option>
                              {activeSections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Section {s.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => assignTeacher(g.id)}
                              className="col-span-3 text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
