"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Grade = {
  id: string;
  displayName: string;
  periods: { id: string; name: string }[];
  setting: { gradingScaleId: string; gradingScaleName: string } | null;
};

export default function CoScholasticConfigClient({
  schoolId,
  activeSession,
  areas,
  gradingScales,
  grades,
}: {
  schoolId: string;
  activeSession: { id: string; name: string } | null;
  areas: { id: string; name: string }[];
  gradingScales: { id: string; name: string }[];
  grades: Grade[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [expandedGradeId, setExpandedGradeId] = useState<string | null>(null);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [selectedScaleId, setSelectedScaleId] = useState<Record<string, string>>({});

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

  async function addArea() {
    if (!newAreaName.trim()) return;
    const result = await call(`/api/schools/${schoolId}/co-scholastic-areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAreaName.trim() }),
    });
    if (result) setNewAreaName("");
  }

  async function saveGradeConfig(gradeId: string, existingPeriods: { name: string }[]) {
    const gradingScaleId = selectedScaleId[gradeId] || grades.find((g) => g.id === gradeId)?.setting?.gradingScaleId;
    if (!gradingScaleId || !activeSession) return setError("Choose a grading scale first.");
    const periodNames = [...existingPeriods.map((p) => p.name)];
    if (newPeriodName.trim()) periodNames.push(newPeriodName.trim());
    await call(`/api/schools/${schoolId}/co-scholastic-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolGradeId: gradeId,
        academicSessionId: activeSession.id,
        periodNames,
        gradingScaleId,
      }),
    });
    setNewPeriodName("");
  }

  return (
    <div className="space-y-8">
      {error && <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Area Catalog</h2>
        <p className="text-xs text-slate-400 mb-3">School-wide, reused every session — like your Subject list.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {areas.map((a) => (
            <span key={a.id} className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1.5">
              {a.name}
            </span>
          ))}
          {areas.length === 0 && <p className="text-slate-400 text-sm">No areas yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="e.g. Work Education"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1"
          />
          <button onClick={addArea} className="text-sm font-semibold text-mega-navy">
            + Add Area
          </button>
        </div>
      </section>

      {!activeSession ? (
        <p className="text-sm text-slate-400">No active academic session — per-grade configuration needs one first.</p>
      ) : (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Per-Grade Configuration — {activeSession.name}</h2>
          <p className="text-xs text-slate-400 mb-3">
            Choose whether a grade uses terms/periods for Co-Scholastic, and which grade levels (scale) apply.
          </p>
          <div className="space-y-2">
            {grades.map((g) => (
              <div key={g.id} className="border border-slate-200 rounded-xl">
                <button
                  onClick={() => setExpandedGradeId(expandedGradeId === g.id ? null : g.id)}
                  className="w-full text-left px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-800">{g.displayName}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {g.setting ? `${g.setting.gradingScaleName}` : "Not configured"}
                    {g.periods.length > 0 ? ` — ${g.periods.map((p) => p.name).join(", ")}` : " — Annual only"}
                  </span>
                </button>
                {expandedGradeId === g.id && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Grading scale (reused from your Assessment Frameworks)</p>
                      <select
                        value={selectedScaleId[g.id] ?? g.setting?.gradingScaleId ?? ""}
                        onChange={(e) => setSelectedScaleId((prev) => ({ ...prev, [g.id]: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <option value="">Choose…</option>
                        {gradingScales.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Periods {g.periods.length === 0 && "(none — evaluated once, annually)"}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {g.periods.map((p) => (
                          <span key={p.id} className="text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">
                            {p.name}
                          </span>
                        ))}
                      </div>
                      <input
                        value={newPeriodName}
                        onChange={(e) => setNewPeriodName(e.target.value)}
                        placeholder="e.g. Term I — leave blank if annual-only"
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-64"
                      />
                    </div>
                    <button
                      onClick={() => saveGradeConfig(g.id, g.periods)}
                      className="text-sm font-semibold text-mega-navy"
                    >
                      Save →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
