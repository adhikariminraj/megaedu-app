"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Component = { id: string; periodId: string | null; name: string; maxMarks: number; entryMode: string };
type Student = { studentId: string; name: string; publicationStatus: string };
type ResultRow = {
  id: string;
  componentId: string;
  studentId: string;
  status: string;
  marksObtained: number | null;
  gradeLabel: string | null;
  remarks: string | null;
};

type Entry = { status: string; marksObtained: string; gradeLabel: string; remarks: string };

export default function AssessmentResultsEntryClient({
  schoolId,
  assignmentId,
  gradeSubjectId,
  gradeName,
  subjectName,
  framework,
  students,
  results,
}: {
  schoolId: string;
  assignmentId: string;
  gradeSubjectId: string;
  gradeName: string;
  subjectName: string;
  framework: {
    id: string;
    name: string;
    periods: { id: string; name: string }[];
    components: Component[];
    gradingScaleBands: { label: string }[];
  };
  students: Student[];
  results: ResultRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resultByKey = new Map(results.map((r) => [`${r.componentId}:${r.studentId}`, r]));
  const publicationByStudentId = new Map(students.map((s) => [s.studentId, s.publicationStatus]));

  const [entries, setEntries] = useState<Record<string, Entry>>(() => {
    const initial: Record<string, Entry> = {};
    for (const c of framework.components) {
      for (const s of students) {
        const existing = resultByKey.get(`${c.id}:${s.studentId}`);
        initial[`${c.id}:${s.studentId}`] = {
          status: existing?.status ?? "PENDING",
          marksObtained: existing?.marksObtained?.toString() ?? "",
          gradeLabel: existing?.gradeLabel ?? "",
          remarks: existing?.remarks ?? "",
        };
      }
    }
    return initial;
  });

  function setEntry(componentId: string, studentId: string, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [`${componentId}:${studentId}`]: { ...prev[`${componentId}:${studentId}`], ...patch } }));
  }

  async function call(url: string, options: RequestInit) {
    setError(null);
    setNotice(null);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return body;
  }

  async function saveComponent(component: Component) {
    const eligibleStudents = students.filter((s) => publicationByStudentId.get(s.studentId) !== "PUBLISHED");
    const payload = eligibleStudents.map((s) => {
      const e = entries[`${component.id}:${s.studentId}`];
      return {
        studentId: s.studentId,
        status: e.status,
        marksObtained: e.status === "EVALUATED" && component.entryMode === "MARKS" ? Number(e.marksObtained) : undefined,
        gradeLabel: e.status === "EVALUATED" && component.entryMode === "GRADE" ? e.gradeLabel : undefined,
        remarks: e.remarks || undefined,
      };
    });
    const result = await call(
      `/api/schools/${schoolId}/assessment-framework-assignments/${assignmentId}/components/${component.id}/results`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeSubjectId, results: payload }),
      }
    );
    if (result) setNotice(`Saved ${result.updated} result(s)${result.skipped ? `, ${result.skipped} skipped` : ""}.`);
  }

  async function publishAll() {
    const result = await call(
      `/api/schools/${schoolId}/assessment-framework-assignments/${assignmentId}/subjects/${gradeSubjectId}/publish`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
    );
    if (result) setNotice(`Published ${result.published} student(s)${result.skipped ? `, ${result.skipped} not eligible/already published` : ""}.`);
  }

  async function correctResult(resultId: string, componentId: string, studentId: string) {
    const e = entries[`${componentId}:${studentId}`];
    const component = framework.components.find((c) => c.id === componentId)!;
    const result = await call(`/api/schools/${schoolId}/assessment-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: e.status,
        marksObtained: e.status === "EVALUATED" && component.entryMode === "MARKS" ? Number(e.marksObtained) : undefined,
        gradeLabel: e.status === "EVALUATED" && component.entryMode === "GRADE" ? e.gradeLabel : undefined,
        remarks: e.remarks || undefined,
      }),
    });
    if (result) setNotice(result.audited ? "Correction saved and audited (subject already published)." : "Correction saved.");
  }

  const componentsByPeriod = new Map<string | null, Component[]>();
  for (const c of framework.components) {
    componentsByPeriod.set(c.periodId, [...(componentsByPeriod.get(c.periodId) || []), c]);
  }

  function renderComponent(component: Component) {
    return (
      <div key={component.id} className="border border-slate-200 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-slate-800">
            {component.name} <span className="text-slate-400 text-xs">— {component.maxMarks} ({component.entryMode})</span>
          </span>
          <button onClick={() => saveComponent(component)} className="text-xs font-semibold text-mega-navy">
            Save →
          </button>
        </div>
        <div className="space-y-1">
          {students.map((s) => {
            const key = `${component.id}:${s.studentId}`;
            const e = entries[key];
            const existing = resultByKey.get(key);
            const isPublished = publicationByStudentId.get(s.studentId) === "PUBLISHED";
            return (
              <div key={s.studentId} className="flex items-center gap-2 text-sm">
                <span className="w-32 truncate">{s.name}</span>
                <select
                  value={e.status}
                  onChange={(ev) => setEntry(component.id, s.studentId, { status: ev.target.value })}
                  className="border border-slate-300 rounded px-1 py-1 text-xs"
                  disabled={isPublished}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="EVALUATED">EVALUATED</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
                {e.status === "EVALUATED" && component.entryMode === "MARKS" && (
                  <input
                    type="number"
                    value={e.marksObtained}
                    onChange={(ev) => setEntry(component.id, s.studentId, { marksObtained: ev.target.value })}
                    placeholder={`0-${component.maxMarks}`}
                    className="border border-slate-300 rounded px-1 py-1 text-xs w-20"
                    disabled={isPublished}
                  />
                )}
                {e.status === "EVALUATED" && component.entryMode === "GRADE" && (
                  <select
                    value={e.gradeLabel}
                    onChange={(ev) => setEntry(component.id, s.studentId, { gradeLabel: ev.target.value })}
                    className="border border-slate-300 rounded px-1 py-1 text-xs"
                    disabled={isPublished}
                  >
                    <option value="">Grade…</option>
                    {framework.gradingScaleBands.map((b) => (
                      <option key={b.label} value={b.label}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                )}
                {component.entryMode === "DESCRIPTIVE" && (
                  <input
                    value={e.remarks}
                    onChange={(ev) => setEntry(component.id, s.studentId, { remarks: ev.target.value })}
                    placeholder="Remarks"
                    className="border border-slate-300 rounded px-1 py-1 text-xs flex-1"
                    disabled={isPublished}
                  />
                )}
                {isPublished && existing && (
                  <button onClick={() => correctResult(existing.id, component.id, s.studentId)} className="text-xs text-amber-600 font-medium">
                    Published — Correct →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-xs mb-1">
        <Link href="/dashboard/assessment-results" className="text-mega-blue">
          ← All subjects
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">
        {gradeName} — {subjectName}
      </h1>
      <p className="text-sm text-slate-500 mb-8">Framework: {framework.name}</p>

      {error && (
        <div className="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
      {notice && (
        <div className="mb-4 text-sm text-mega-green border border-green-200 bg-green-50 rounded-lg px-3 py-2">{notice}</div>
      )}

      {framework.periods.length === 0
        ? (componentsByPeriod.get(null) || []).map(renderComponent)
        : framework.periods.map((p) => (
            <div key={p.id} className="mb-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">{p.name}</h3>
              {(componentsByPeriod.get(p.id) || []).map(renderComponent)}
            </div>
          ))}
      {framework.periods.length > 0 && (componentsByPeriod.get(null) || []).length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">(No period)</h3>
          {(componentsByPeriod.get(null) || []).map(renderComponent)}
        </div>
      )}

      <div className="border border-dashed border-slate-300 rounded-xl p-4 mt-6">
        <p className="text-sm font-medium text-slate-700 mb-2">Publish</p>
        <p className="text-xs text-slate-400 mb-3">
          Publishing fails for any student whose required components are still PENDING — descriptive components don't block it.
        </p>
        <div className="space-y-1 mb-3 text-xs text-slate-500">
          {students.map((s) => (
            <div key={s.studentId} className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className={s.publicationStatus === "PUBLISHED" ? "text-mega-green font-medium" : "text-amber-600"}>
                {s.publicationStatus}
              </span>
            </div>
          ))}
        </div>
        <button onClick={publishAll} className="text-xs font-semibold text-mega-navy">
          Publish all eligible →
        </button>
      </div>
    </div>
  );
}
