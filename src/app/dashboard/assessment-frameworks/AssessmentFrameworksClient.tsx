"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Band = {
  id?: string;
  minPercent: number | "";
  maxPercent: number | "";
  label: string;
  gradePoint: number | "";
  description: string;
};
type GradingScale = {
  id: string;
  name: string;
  isActive: boolean;
  bands: { id: string; minPercent: number; maxPercent: number; label: string; gradePoint: number | null; description: string | null }[];
};
type ComponentRow = {
  id?: string;
  periodId: string | null;
  periodName?: string; // used only for the create-framework draft, before periods have ids
  name: string;
  maxMarks: number | "";
  entryMode: "MARKS" | "GRADE" | "DESCRIPTIVE";
};
type Framework = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  gradingScaleId: string | null;
  gradingScaleName: string | null;
  periods: { id: string; name: string }[];
  components: { id: string; periodId: string | null; name: string; maxMarks: number; entryMode: string }[];
};
type Grade = { id: string; displayName: string; offeredSubjects: { id: string; subjectName: string }[] };
type Assignment = {
  id: string;
  schoolGradeId: string;
  gradeSubjectId: string | null;
  subjectName: string | null;
  frameworkId: string;
  frameworkName: string;
};

const ENTRY_MODES = ["MARKS", "GRADE", "DESCRIPTIVE"] as const;

const emptyBand = (): Band => ({ minPercent: "", maxPercent: "", label: "", gradePoint: "", description: "" });
const emptyComponent = (): ComponentRow => ({ periodId: null, periodName: "", name: "", maxMarks: "", entryMode: "MARKS" });

export default function AssessmentFrameworksClient({
  schoolId,
  schoolName,
  activeSession,
  gradingScales,
  frameworks,
  grades,
  assignments,
}: {
  schoolId: string;
  schoolName: string;
  activeSession: { id: string; name: string } | null;
  gradingScales: GradingScale[];
  frameworks: Framework[];
  grades: Grade[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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

  // ---------- Grading Scales ----------
  const [scaleName, setScaleName] = useState("");
  const [scaleBands, setScaleBands] = useState<Band[]>([emptyBand()]);

  async function createScale() {
    if (!scaleName.trim()) return setError("Enter a grading scale name.");
    const bands = scaleBands
      .filter((b) => b.label.trim())
      .map((b) => ({
        minPercent: Number(b.minPercent),
        maxPercent: Number(b.maxPercent),
        label: b.label.trim(),
        gradePoint: b.gradePoint === "" ? null : Number(b.gradePoint),
        description: b.description.trim() || null,
      }));
    const result = await call(`/api/schools/${schoolId}/grading-scales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: scaleName.trim(), bands }),
    });
    if (result) {
      setScaleName("");
      setScaleBands([emptyBand()]);
    }
  }

  async function toggleScaleActive(scale: GradingScale) {
    await call(`/api/schools/${schoolId}/grading-scales/${scale.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !scale.isActive }),
    });
  }

  // ---------- Assessment Frameworks ----------
  const [fwName, setFwName] = useState("");
  const [fwDescription, setFwDescription] = useState("");
  const [fwGradingScaleId, setFwGradingScaleId] = useState("");
  const [fwPeriods, setFwPeriods] = useState<string[]>([]);
  const [fwNewPeriodName, setFwNewPeriodName] = useState("");
  const [fwComponents, setFwComponents] = useState<ComponentRow[]>([emptyComponent()]);

  async function createFramework() {
    if (!fwName.trim()) return setError("Enter a framework name.");
    const components = fwComponents
      .filter((c) => c.name.trim() && c.maxMarks !== "")
      .map((c) => ({
        name: c.name.trim(),
        maxMarks: Number(c.maxMarks),
        entryMode: c.entryMode,
        periodName: c.periodName?.trim() || null,
      }));
    const result = await call(`/api/schools/${schoolId}/assessment-frameworks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fwName.trim(),
        description: fwDescription.trim() || null,
        gradingScaleId: fwGradingScaleId || null,
        periods: fwPeriods,
        components,
      }),
    });
    if (result) {
      setFwName("");
      setFwDescription("");
      setFwGradingScaleId("");
      setFwPeriods([]);
      setFwComponents([emptyComponent()]);
    }
  }

  async function toggleFrameworkActive(fw: Framework) {
    await call(`/api/schools/${schoolId}/assessment-frameworks/${fw.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !fw.isActive }),
    });
  }

  // ---------- Add period / component to an existing framework ----------
  const [addPeriodName, setAddPeriodName] = useState<Record<string, string>>({});
  const [addComponentForm, setAddComponentForm] = useState<
    Record<string, { name: string; maxMarks: string; entryMode: string; periodId: string }>
  >({});

  async function addPeriodToFramework(frameworkId: string) {
    const name = addPeriodName[frameworkId]?.trim();
    if (!name) return;
    const result = await call(`/api/schools/${schoolId}/assessment-frameworks/${frameworkId}/periods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (result) setAddPeriodName((p) => ({ ...p, [frameworkId]: "" }));
  }

  async function addComponentToFramework(frameworkId: string) {
    const form = addComponentForm[frameworkId];
    if (!form?.name.trim() || !form.maxMarks) return;
    const result = await call(`/api/schools/${schoolId}/assessment-frameworks/${frameworkId}/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        maxMarks: Number(form.maxMarks),
        entryMode: form.entryMode || "MARKS",
        periodId: form.periodId || null,
      }),
    });
    if (result) setAddComponentForm((p) => ({ ...p, [frameworkId]: { name: "", maxMarks: "", entryMode: "MARKS", periodId: "" } }));
  }

  async function deleteComponent(frameworkId: string, componentId: string) {
    await call(`/api/schools/${schoolId}/assessment-frameworks/${frameworkId}/components/${componentId}`, {
      method: "DELETE",
    });
  }

  // ---------- Framework Assignments ----------
  const [assignGradeId, setAssignGradeId] = useState("");
  const [assignGradeSubjectId, setAssignGradeSubjectId] = useState("");
  const [assignFrameworkId, setAssignFrameworkId] = useState("");

  async function createAssignment() {
    if (!activeSession) return setError("No active academic session.");
    if (!assignGradeId || !assignFrameworkId) return setError("Pick a grade and a framework.");
    const result = await call(`/api/schools/${schoolId}/assessment-framework-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicSessionId: activeSession.id,
        schoolGradeId: assignGradeId,
        gradeSubjectId: assignGradeSubjectId || null,
        frameworkId: assignFrameworkId,
      }),
    });
    if (result) {
      setAssignGradeId("");
      setAssignGradeSubjectId("");
      setAssignFrameworkId("");
    }
  }

  async function removeAssignment(assignmentId: string) {
    await call(`/api/schools/${schoolId}/assessment-framework-assignments/${assignmentId}`, {
      method: "DELETE",
    });
  }

  const activeGradingScales = gradingScales.filter((s) => s.isActive);
  const activeFrameworks = frameworks.filter((f) => f.isActive);
  const assignGradeSubjects = grades.find((g) => g.id === assignGradeId)?.offeredSubjects || [];

  return (
    <div className="px-3 pb-8">
      <p className="text-xs text-slate-400 mb-8">
        Configuration only — no marks entry, calculation, or report cards yet. Grading scales and
        frameworks are reusable templates; assigning one to a grade or subject is what's specific to{" "}
        {activeSession ? activeSession.name : "the active session"}.
      </p>

      {error && (
        <div className="mb-6 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ================= Grading Scales ================= */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Grading Scales</h2>
        <p className="text-xs text-slate-400 mb-4">
          Reusable, school-wide marks→grade conversion tables. A framework may use none (marks-only or
          descriptive-only).
        </p>

        <div className="space-y-3 mb-6">
          {gradingScales.length === 0 && <p className="text-slate-400 text-sm">No grading scales yet.</p>}
          {gradingScales.map((scale) => (
            <div key={scale.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-800">
                  {scale.name}
                  {!scale.isActive && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                </span>
                <button
                  onClick={() => toggleScaleActive(scale)}
                  className="text-xs text-mega-blue font-medium"
                >
                  {scale.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                {scale.bands.map((b) => (
                  <div key={b.id}>
                    {b.minPercent}–{b.maxPercent}% — <span className="font-medium">{b.label}</span>
                    {b.gradePoint !== null ? ` (${b.gradePoint} GPA)` : ""}
                    {b.description ? ` — ${b.description}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-dashed border-slate-300 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">New grading scale</p>
          <input
            value={scaleName}
            onChange={(e) => setScaleName(e.target.value)}
            placeholder="Scale name (e.g. National Scale 2081)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="space-y-2 mb-2">
            {scaleBands.map((b, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                <input
                  value={b.minPercent}
                  onChange={(e) =>
                    setScaleBands((rows) => rows.map((r, j) => (j === i ? { ...r, minPercent: e.target.value === "" ? "" : Number(e.target.value) } : r)))
                  }
                  placeholder="Min %"
                  type="number"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={b.maxPercent}
                  onChange={(e) =>
                    setScaleBands((rows) => rows.map((r, j) => (j === i ? { ...r, maxPercent: e.target.value === "" ? "" : Number(e.target.value) } : r)))
                  }
                  placeholder="Max %"
                  type="number"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={b.label}
                  onChange={(e) => setScaleBands((rows) => rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                  placeholder="Label (A+)"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={b.gradePoint}
                  onChange={(e) =>
                    setScaleBands((rows) => rows.map((r, j) => (j === i ? { ...r, gradePoint: e.target.value === "" ? "" : Number(e.target.value) } : r)))
                  }
                  placeholder="GPA (opt.)"
                  type="number"
                  step="0.1"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={b.description}
                  onChange={(e) => setScaleBands((rows) => rows.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  placeholder="Description (opt.)"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setScaleBands((rows) => [...rows, emptyBand()])}
              className="text-xs text-mega-blue font-medium"
            >
              + Add band
            </button>
            <button onClick={createScale} className="text-xs font-semibold text-mega-navy ml-auto">
              Create grading scale →
            </button>
          </div>
        </div>
      </section>

      {/* ================= Assessment Frameworks ================= */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Assessment Frameworks</h2>
        <p className="text-xs text-slate-400 mb-4">
          A component's <span className="font-medium">Max Marks</span> is its contribution toward the
          framework total — a 10%-weighted component and a component worth 10 raw marks are the same
          thing here.
        </p>

        <div className="space-y-4 mb-6">
          {frameworks.length === 0 && <p className="text-slate-400 text-sm">No frameworks yet.</p>}
          {frameworks.map((fw) => {
            const componentsByPeriod = new Map<string | null, typeof fw.components>();
            for (const c of fw.components) {
              const key = c.periodId;
              componentsByPeriod.set(key, [...(componentsByPeriod.get(key) || []), c]);
            }
            const totalMax = fw.components.reduce((sum, c) => sum + c.maxMarks, 0);
            const acForm = addComponentForm[fw.id] || { name: "", maxMarks: "", entryMode: "MARKS", periodId: "" };

            return (
              <div key={fw.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-800">
                    {fw.name}
                    {!fw.isActive && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                  </span>
                  <button onClick={() => toggleFrameworkActive(fw)} className="text-xs text-mega-blue font-medium">
                    {fw.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
                {fw.description && <p className="text-xs text-slate-500 mb-2">{fw.description}</p>}
                <p className="text-xs text-slate-400 mb-3">
                  Grading scale: {fw.gradingScaleName || "None (marks-only / descriptive)"} · Total max marks:{" "}
                  {totalMax}
                </p>

                {fw.periods.length === 0 ? (
                  <ComponentList
                    components={componentsByPeriod.get(null) || []}
                    onDelete={(cid) => deleteComponent(fw.id, cid)}
                  />
                ) : (
                  <div className="space-y-2 mb-2">
                    {fw.periods.map((p) => (
                      <div key={p.id}>
                        <p className="text-xs font-semibold text-slate-600">{p.name}</p>
                        <ComponentList
                          components={componentsByPeriod.get(p.id) || []}
                          onDelete={(cid) => deleteComponent(fw.id, cid)}
                        />
                      </div>
                    ))}
                    {(componentsByPeriod.get(null) || []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600">(No period)</p>
                        <ComponentList
                          components={componentsByPeriod.get(null) || []}
                          onDelete={(cid) => deleteComponent(fw.id, cid)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <input
                    value={addPeriodName[fw.id] || ""}
                    onChange={(e) => setAddPeriodName((p) => ({ ...p, [fw.id]: e.target.value }))}
                    placeholder="New period name"
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-32"
                  />
                  <button onClick={() => addPeriodToFramework(fw.id)} className="text-xs text-mega-blue font-medium">
                    + Add period
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <input
                    value={acForm.name}
                    onChange={(e) => setAddComponentForm((p) => ({ ...p, [fw.id]: { ...acForm, name: e.target.value } }))}
                    placeholder="Component name"
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-32"
                  />
                  <input
                    value={acForm.maxMarks}
                    onChange={(e) => setAddComponentForm((p) => ({ ...p, [fw.id]: { ...acForm, maxMarks: e.target.value } }))}
                    placeholder="Max marks"
                    type="number"
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-20"
                  />
                  <select
                    value={acForm.entryMode}
                    onChange={(e) => setAddComponentForm((p) => ({ ...p, [fw.id]: { ...acForm, entryMode: e.target.value } }))}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                  >
                    {ENTRY_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {fw.periods.length > 0 && (
                    <select
                      value={acForm.periodId}
                      onChange={(e) => setAddComponentForm((p) => ({ ...p, [fw.id]: { ...acForm, periodId: e.target.value } }))}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="">No period</option>
                      {fw.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => addComponentToFramework(fw.id)} className="text-xs text-mega-blue font-medium">
                    + Add component
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border border-dashed border-slate-300 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">New assessment framework</p>
          <input
            value={fwName}
            onChange={(e) => setFwName(e.target.value)}
            placeholder="Framework name (e.g. Grade 4 Standard)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <input
            value={fwDescription}
            onChange={(e) => setFwDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <select
            value={fwGradingScaleId}
            onChange={(e) => setFwGradingScaleId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
          >
            <option value="">No grading scale (marks-only / descriptive)</option>
            {activeGradingScales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <p className="text-xs text-slate-500 mb-1">Periods (optional — leave empty for a flat structure)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {fwPeriods.map((p) => (
              <span key={p} className="text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">
                {p}{" "}
                <button onClick={() => setFwPeriods((rows) => rows.filter((x) => x !== p))} className="text-slate-400">
                  ×
                </button>
              </span>
            ))}
            <input
              value={fwNewPeriodName}
              onChange={(e) => setFwNewPeriodName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && fwNewPeriodName.trim()) {
                  e.preventDefault();
                  setFwPeriods((rows) => [...rows, fwNewPeriodName.trim()]);
                  setFwNewPeriodName("");
                }
              }}
              placeholder="Period name, press Enter"
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-40"
            />
          </div>

          <p className="text-xs text-slate-500 mb-1">Components</p>
          <div className="space-y-2 mb-2">
            {fwComponents.map((c, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <input
                  value={c.name}
                  onChange={(e) => setFwComponents((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  placeholder="Name"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  value={c.maxMarks}
                  onChange={(e) =>
                    setFwComponents((rows) => rows.map((r, j) => (j === i ? { ...r, maxMarks: e.target.value === "" ? "" : Number(e.target.value) } : r)))
                  }
                  placeholder="Max marks"
                  type="number"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <select
                  value={c.entryMode}
                  onChange={(e) =>
                    setFwComponents((rows) => rows.map((r, j) => (j === i ? { ...r, entryMode: e.target.value as ComponentRow["entryMode"] } : r)))
                  }
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {ENTRY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {fwPeriods.length > 0 ? (
                  <select
                    value={c.periodName}
                    onChange={(e) => setFwComponents((rows) => rows.map((r, j) => (j === i ? { ...r, periodName: e.target.value } : r)))}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">No period</option>
                    {fwPeriods.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setFwComponents((rows) => [...rows, emptyComponent()])}
              className="text-xs text-mega-blue font-medium"
            >
              + Add component
            </button>
            <button onClick={createFramework} className="text-xs font-semibold text-mega-navy ml-auto">
              Create framework →
            </button>
          </div>
        </div>
      </section>

      {/* ================= Framework Assignments ================= */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Framework Assignments</h2>
        <p className="text-xs text-slate-400 mb-4">
          {activeSession
            ? `Assign a framework to a grade (default) or one specific subject (override) for ${activeSession.name}.`
            : "No active academic session — assignments require one."}
        </p>

        <div className="space-y-2 mb-6">
          {assignments.length === 0 && <p className="text-slate-400 text-sm">No assignments yet this session.</p>}
          {assignments.map((a) => {
            const gradeName = grades.find((g) => g.id === a.schoolGradeId)?.displayName || "—";
            return (
              <div
                key={a.id}
                className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{gradeName}</span>
                  <span className="text-slate-400"> — {a.subjectName ? `${a.subjectName} (override)` : "Default"} — </span>
                  {a.frameworkName}
                </span>
                <button onClick={() => removeAssignment(a.id)} className="text-xs text-red-500">
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        {activeSession && (
          <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-wrap gap-2 items-center">
            <select
              value={assignGradeId}
              onChange={(e) => {
                setAssignGradeId(e.target.value);
                setAssignGradeSubjectId("");
              }}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Grade…</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}
                </option>
              ))}
            </select>
            <select
              value={assignGradeSubjectId}
              onChange={(e) => setAssignGradeSubjectId(e.target.value)}
              disabled={!assignGradeId}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Grade default (no subject)</option>
              {assignGradeSubjects.map((gs) => (
                <option key={gs.id} value={gs.id}>
                  {gs.subjectName} (override)
                </option>
              ))}
            </select>
            <select
              value={assignFrameworkId}
              onChange={(e) => setAssignFrameworkId(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Framework…</option>
              {activeFrameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button onClick={createAssignment} className="text-xs font-semibold text-mega-navy ml-auto">
              Assign →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ComponentList({
  components,
  onDelete,
}: {
  components: { id: string; name: string; maxMarks: number; entryMode: string }[];
  onDelete: (id: string) => void;
}) {
  if (components.length === 0) return <p className="text-xs text-slate-400 mb-2">No components yet.</p>;
  return (
    <div className="space-y-1 mb-2">
      {components.map((c) => (
        <div key={c.id} className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {c.name} — {c.maxMarks} ({c.entryMode})
          </span>
          <button onClick={() => onDelete(c.id)} className="text-red-400">
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
