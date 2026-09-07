"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Area = { id: string; name: string };
type Period = { id: string; name: string };
type Student = { studentId: string; name: string };
type ResultRow = { areaId: string; studentId: string; coScholasticPeriodId: string | null; gradeLabel: string };

/** null represents the always-present Annual scope. */
type Scope = string | null;

export default function CoScholasticEntryClient({
  schoolId,
  schoolGradeId,
  academicSessionId,
  gradeName,
  areas,
  periods,
  gradeLabels,
  students,
  results,
}: {
  schoolId: string;
  schoolGradeId: string;
  academicSessionId: string;
  gradeName: string;
  areas: Area[];
  periods: Period[];
  gradeLabels: string[];
  students: Student[];
  results: ResultRow[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resultByKey = new Map(
    results.map((r) => [`${r.areaId}:${r.studentId}:${r.coScholasticPeriodId ?? "ANNUAL"}`, r.gradeLabel])
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const a of areas) {
      for (const s of students) {
        for (const p of [null, ...periods.map((p) => p.id)]) {
          const key = `${a.id}:${s.studentId}:${p ?? "ANNUAL"}`;
          initial[key] = resultByKey.get(key) ?? "";
        }
      }
    }
    return initial;
  });

  function setValue(areaId: string, studentId: string, s: Scope, value: string) {
    setValues((prev) => ({ ...prev, [`${areaId}:${studentId}:${s ?? "ANNUAL"}`]: value }));
  }

  async function saveArea(areaId: string) {
    setError(null);
    setNotice(null);
    const payload = students
      .map((s) => ({ studentId: s.studentId, gradeLabel: values[`${areaId}:${s.studentId}:${scope ?? "ANNUAL"}`] }))
      .filter((r) => r.gradeLabel);
    if (payload.length === 0) return;
    const res = await fetch(`/api/schools/${schoolId}/co-scholastic-results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areaId,
        schoolGradeId,
        academicSessionId,
        coScholasticPeriodId: scope,
        results: payload,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setNotice(`Saved ${body.updated} result(s)${body.skipped ? `, ${body.skipped} skipped` : ""}.`);
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-xs mb-1">
        <Link href="/dashboard/co-scholastic" className="text-mega-blue">
          ← All grades
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{gradeName} — Co-Scholastic</h1>
      <p className="text-sm text-slate-500 mb-6">
        A separate, simpler evaluation — no marks, no weights, just a grade per area. The Annual entry is always
        independent, never combined from term entries.
      </p>

      {periods.length > 0 && (
        <div className="flex gap-2 mb-6">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setScope(p.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                scope === p.id ? "border-mega-navy bg-slate-50" : "border-slate-200 text-slate-500"
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setScope(null)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              scope === null ? "border-mega-navy bg-slate-50" : "border-slate-200 text-slate-500"
            }`}
          >
            Annual (Final)
          </button>
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div className="mb-4 text-sm text-mega-green border border-green-200 bg-green-50 rounded-lg px-3 py-2">{notice}</div>}

      {areas.length === 0 ? (
        <p className="text-slate-400 text-sm">No Co-Scholastic areas configured yet.</p>
      ) : (
        areas.map((a) => (
          <div key={a.id} className="border border-slate-200 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-800">{a.name}</span>
              <button onClick={() => saveArea(a.id)} className="text-xs font-semibold text-mega-navy">
                Save →
              </button>
            </div>
            <div className="space-y-1">
              {students.map((s) => (
                <div key={s.studentId} className="flex items-center gap-2 text-sm">
                  <span className="w-40 truncate">{s.name}</span>
                  <select
                    value={values[`${a.id}:${s.studentId}:${scope ?? "ANNUAL"}`] ?? ""}
                    onChange={(e) => setValue(a.id, s.studentId, scope, e.target.value)}
                    className="border border-slate-300 rounded px-1 py-1 text-xs"
                  >
                    <option value="">Grade…</option>
                    {gradeLabels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
