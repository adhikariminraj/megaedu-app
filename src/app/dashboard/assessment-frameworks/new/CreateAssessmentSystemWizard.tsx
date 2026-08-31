"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Grade = { id: string; displayName: string; offeredSubjects: { id: string; subjectName: string }[] };
type ExistingScale = { id: string; name: string };

type AssessmentRow = {
  key: string;
  periodName: string | null;
  name: string;
  maxMarks: string;
  entryMode: "MARKS" | "GRADE" | "DESCRIPTIVE";
  showAdvanced: boolean;
};
type LevelRow = { label: string; minPercent: string; maxPercent: string; description: string };

const STANDARD_LEVELS: LevelRow[] = [
  { label: "A+", minPercent: "90", maxPercent: "100", description: "Outstanding" },
  { label: "A", minPercent: "80", maxPercent: "90", description: "Excellent" },
  { label: "B+", minPercent: "70", maxPercent: "80", description: "Very Good" },
  { label: "B", minPercent: "60", maxPercent: "70", description: "Good" },
  { label: "C", minPercent: "40", maxPercent: "60", description: "Acceptable" },
  { label: "D", minPercent: "0", maxPercent: "40", description: "Needs Improvement" },
];

let rowKeyCounter = 0;
const nextKey = () => `row-${++rowKeyCounter}`;

export default function CreateAssessmentSystemWizard({
  schoolId,
  schoolName,
  activeSession,
  existingScales,
  grades,
}: {
  schoolId: string;
  schoolName: string;
  activeSession: { id: string; name: string } | null;
  existingScales: ExistingScale[];
  grades: Grade[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2
  const [usesPeriods, setUsesPeriods] = useState<boolean | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [newPeriodName, setNewPeriodName] = useState("");

  // Step 3
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);

  // Step 4
  const [resultsChoice, setResultsChoice] = useState<"MARKS_ONLY" | "WITH_GRADE" | "">("");
  const [gradeSource, setGradeSource] = useState<"EXISTING" | "STANDARD" | "CUSTOM" | "">("");
  const [existingScaleId, setExistingScaleId] = useState("");
  const [levels, setLevels] = useState<LevelRow[]>([]);

  // Step 5
  const [applyScope, setApplyScope] = useState<"WHOLE_GRADE" | "ONE_SUBJECT" | "SKIP" | "">("");
  const [applyGradeId, setApplyGradeId] = useState("");
  const [applyGradeSubjectId, setApplyGradeSubjectId] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addPeriod(value: string) {
    const trimmed = value.trim();
    if (!trimmed || periods.includes(trimmed)) return;
    setPeriods((p) => [...p, trimmed]);
    setNewPeriodName("");
  }

  function addAssessment(periodName: string | null) {
    setAssessments((rows) => [
      ...rows,
      { key: nextKey(), periodName, name: "", maxMarks: "", entryMode: "MARKS", showAdvanced: false },
    ]);
  }
  function updateAssessment(key: string, patch: Partial<AssessmentRow>) {
    setAssessments((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeAssessment(key: string) {
    setAssessments((rows) => rows.filter((r) => r.key !== key));
  }

  function startLevels(source: "STANDARD" | "CUSTOM") {
    setGradeSource(source);
    setLevels(source === "STANDARD" ? STANDARD_LEVELS.map((l) => ({ ...l })) : [{ label: "", minPercent: "", maxPercent: "", description: "" }]);
  }
  function addLevel() {
    setLevels((rows) => [...rows, { label: "", minPercent: "", maxPercent: "", description: "" }]);
  }
  function updateLevel(i: number, patch: Partial<LevelRow>) {
    setLevels((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeLevel(i: number) {
    setLevels((rows) => rows.filter((_, j) => j !== i));
  }

  const periodGroups: (string | null)[] = usesPeriods ? periods : [null];
  const totalMarksByGroup = (p: string | null) =>
    assessments.filter((a) => a.periodName === p).reduce((sum, a) => sum + (Number(a.maxMarks) || 0), 0);

  function canProceed(): boolean {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return usesPeriods === false || (usesPeriods === true && periods.length > 0);
    if (step === 3) return assessments.length > 0 && assessments.every((a) => a.name.trim() && Number(a.maxMarks) > 0);
    if (step === 4) {
      if (resultsChoice === "MARKS_ONLY") return true;
      if (resultsChoice === "WITH_GRADE") {
        if (gradeSource === "EXISTING") return !!existingScaleId;
        if (gradeSource === "STANDARD" || gradeSource === "CUSTOM") {
          return levels.length > 0 && levels.every((l) => l.label.trim() && l.minPercent !== "" && l.maxPercent !== "" && Number(l.minPercent) < Number(l.maxPercent));
        }
        return false;
      }
      return false;
    }
    if (step === 5) {
      if (applyScope === "SKIP") return true;
      if (applyScope === "WHOLE_GRADE") return !!applyGradeId;
      if (applyScope === "ONE_SUBJECT") return !!applyGradeId && !!applyGradeSubjectId;
      return false;
    }
    return true;
  }

  function resultsChoiceSummary(): string {
    if (resultsChoice === "MARKS_ONLY") return "Just the marks (e.g. 85/100)";
    if (gradeSource === "EXISTING") return `Marks with a grade, using "${existingScales.find((s) => s.id === existingScaleId)?.name}"`;
    if (gradeSource === "STANDARD") return "Marks with a grade, using our standard grade levels";
    if (gradeSource === "CUSTOM") return "Marks with a grade, using grade levels you set up";
    return "Not set";
  }

  async function handleCreate() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let gradingScaleId: string | null = null;
      if (resultsChoice === "WITH_GRADE") {
        if (gradeSource === "EXISTING") {
          gradingScaleId = existingScaleId;
        } else {
          const res = await fetch(`/api/schools/${schoolId}/grading-scales`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${name.trim()} Grade Levels`,
              bands: levels.map((l) => ({
                minPercent: Number(l.minPercent),
                maxPercent: Number(l.maxPercent),
                label: l.label.trim(),
                description: l.description.trim() || null,
              })),
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(`Couldn't save the grade levels: ${body.error || "please try again."}`);
          gradingScaleId = body.scale.id;
        }
      }

      const fwRes = await fetch(`/api/schools/${schoolId}/assessment-frameworks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          gradingScaleId,
          periods: usesPeriods ? periods : [],
          components: assessments.map((a) => ({
            name: a.name.trim(),
            maxMarks: Number(a.maxMarks),
            entryMode: a.entryMode,
            periodName: a.periodName,
          })),
        }),
      });
      const fwBody = await fwRes.json();
      if (!fwRes.ok) {
        throw new Error(
          gradingScaleId
            ? `Your grade levels were saved, but the assessment system itself couldn't be created: ${fwBody.error || "please try again."}`
            : `Couldn't create the assessment system: ${fwBody.error || "please try again."}`
        );
      }
      const frameworkId = fwBody.framework.id;

      if (applyScope !== "SKIP" && activeSession) {
        const assignRes = await fetch(`/api/schools/${schoolId}/assessment-framework-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academicSessionId: activeSession.id,
            schoolGradeId: applyGradeId,
            gradeSubjectId: applyScope === "ONE_SUBJECT" ? applyGradeSubjectId : null,
            frameworkId,
          }),
        });
        const assignBody = await assignRes.json();
        if (!assignRes.ok) {
          throw new Error(
            `Your assessment system was created, but couldn't be applied automatically: ${assignBody.error || "please try again from Advanced management."}`
          );
        }
      }

      setDone(true);
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-4xl mb-3">🎉</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Your assessment system is ready</h1>
        <p className="text-sm text-slate-500 mb-8">
          &quot;{name}&quot; has been created{applyScope !== "SKIP" ? " and applied" : ""}.
        </p>
        <div className="flex flex-col gap-2 items-center">
          <Link href="/dashboard/assessment-results" className="text-sm font-semibold text-mega-navy">
            Go to Marks Entry →
          </Link>
          <Link href="/dashboard/assessment-frameworks" className="text-sm text-mega-blue">
            Back to Assessment Frameworks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-xs text-slate-400 mb-1">{schoolName}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Create Assessment System</h1>
      <p className="text-xs text-slate-400 mb-6">
        Step {step} of {totalSteps} — nothing is saved until you confirm at the end.
      </p>

      {/* ---------- Step 1: Name ---------- */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">What is this assessment system called?</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Class 5 Annual Assessment"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional) — e.g. Used for all subjects in Class 5 this year"
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* ---------- Step 2: Periods ---------- */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Does your school use terms or assessment periods?</h2>
          <div className="grid grid-cols-1 gap-2 mb-4">
            <button
              onClick={() => setUsesPeriods(false)}
              className={`text-left border rounded-xl px-4 py-3 text-sm ${usesPeriods === false ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
            >
              <span className="font-medium">No — one overall assessment</span>
              <p className="text-xs text-slate-400 mt-0.5">All assessments count toward a single result.</p>
            </button>
            <button
              onClick={() => setUsesPeriods(true)}
              className={`text-left border rounded-xl px-4 py-3 text-sm ${usesPeriods === true ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
            >
              <span className="font-medium">Yes — use terms / periods</span>
              <p className="text-xs text-slate-400 mt-0.5">e.g. First Term, Second Term, Final Term.</p>
            </button>
          </div>

          {usesPeriods === true && (
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {periods.map((p) => (
                  <span key={p} className="text-xs bg-slate-100 text-slate-600 rounded-full px-3 py-1">
                    {p}{" "}
                    <button onClick={() => setPeriods((rows) => rows.filter((x) => x !== p))} className="text-slate-400">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPeriod(newPeriodName);
                    }
                  }}
                  placeholder="Period name, press Enter"
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm flex-1"
                />
                <button onClick={() => addPeriod(newPeriodName)} className="text-xs font-medium text-mega-blue">
                  + Add
                </button>
              </div>
              <div className="flex gap-2">
                {["First Term", "Second Term", "Final Term"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => addPeriod(suggestion)}
                    disabled={periods.includes(suggestion)}
                    className="text-xs border border-dashed border-slate-300 rounded-full px-3 py-1 text-slate-500 disabled:opacity-30"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Step 3: Assessments ---------- */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">How are students assessed?</h2>
          <p className="text-xs text-slate-400 mb-4">Add each piece of assessment and its full marks.</p>

          {periodGroups.map((group) => (
            <div key={group ?? "flat"} className="mb-5">
              {group && <p className="text-sm font-semibold text-slate-700 mb-2">{group}</p>}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                  <span>Assessment</span>
                  <span>Full Marks</span>
                  <span />
                </div>
                {assessments
                  .filter((a) => a.periodName === group)
                  .map((a) => (
                    <div key={a.key} className="border-t border-slate-100">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center">
                        <input
                          value={a.name}
                          onChange={(e) => updateAssessment(a.key, { name: e.target.value })}
                          placeholder="e.g. Classwork"
                          className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                        />
                        <input
                          value={a.maxMarks}
                          onChange={(e) => updateAssessment(a.key, { maxMarks: e.target.value })}
                          type="number"
                          placeholder="10"
                          className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-20"
                        />
                        <button onClick={() => removeAssessment(a.key)} className="text-red-400 text-xs">
                          Remove
                        </button>
                      </div>
                      <div className="px-3 pb-2">
                        {!a.showAdvanced ? (
                          <button
                            onClick={() => updateAssessment(a.key, { showAdvanced: true })}
                            className="text-xs text-slate-400 underline"
                          >
                            Change how this is scored
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Scored as:</span>
                            {(
                              [
                                ["MARKS", "Marks (e.g. out of 10)"],
                                ["GRADE", "Letter grade (e.g. A, B, C)"],
                                ["DESCRIPTIVE", "Written remark only, no score"],
                              ] as const
                            ).map(([mode, label]) => (
                              <button
                                key={mode}
                                onClick={() => updateAssessment(a.key, { entryMode: mode })}
                                className={`px-2 py-1 rounded-full border ${a.entryMode === mode ? "border-mega-navy bg-slate-50 font-medium" : "border-slate-200 text-slate-500"}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => addAssessment(group)} className="text-xs font-medium text-mega-blue">
                  + Add Assessment
                </button>
                <span className="text-xs text-slate-400">Total: {totalMarksByGroup(group)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Step 4: Results display ---------- */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How should results be shown?</h2>
          <div className="grid grid-cols-1 gap-2 mb-4">
            <button
              onClick={() => {
                setResultsChoice("MARKS_ONLY");
                setGradeSource("");
              }}
              className={`text-left border rounded-xl px-4 py-3 text-sm ${resultsChoice === "MARKS_ONLY" ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
            >
              <span className="font-medium">Just the marks</span>
              <p className="text-xs text-slate-400 mt-0.5">e.g. 85/100</p>
            </button>
            <button
              onClick={() => setResultsChoice("WITH_GRADE")}
              className={`text-left border rounded-xl px-4 py-3 text-sm ${resultsChoice === "WITH_GRADE" ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
            >
              <span className="font-medium">Marks with a grade</span>
              <p className="text-xs text-slate-400 mt-0.5">e.g. 85/100 — A</p>
            </button>
          </div>

          {resultsChoice === "WITH_GRADE" && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {existingScales.length > 0 && (
                  <button
                    onClick={() => setGradeSource("EXISTING")}
                    className={`text-xs border rounded-full px-3 py-1.5 ${gradeSource === "EXISTING" ? "border-mega-navy bg-slate-50 font-medium" : "border-slate-200 text-slate-500"}`}
                  >
                    Use grade levels we already have
                  </button>
                )}
                <button
                  onClick={() => startLevels("STANDARD")}
                  className={`text-xs border rounded-full px-3 py-1.5 ${gradeSource === "STANDARD" ? "border-mega-navy bg-slate-50 font-medium" : "border-slate-200 text-slate-500"}`}
                >
                  Use standard grade levels
                </button>
                <button
                  onClick={() => startLevels("CUSTOM")}
                  className={`text-xs border rounded-full px-3 py-1.5 ${gradeSource === "CUSTOM" ? "border-mega-navy bg-slate-50 font-medium" : "border-slate-200 text-slate-500"}`}
                >
                  Set up our own grade levels
                </button>
              </div>

              {gradeSource === "EXISTING" && (
                <select
                  value={existingScaleId}
                  onChange={(e) => setExistingScaleId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Choose grade levels…</option>
                  {existingScales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {(gradeSource === "STANDARD" || gradeSource === "CUSTOM") && (
                <div>
                  <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-2 px-1 py-1 text-xs font-semibold text-slate-500">
                    <span>Grade</span>
                    <span>From %</span>
                    <span>To %</span>
                    <span>Meaning</span>
                    <span />
                  </div>
                  {levels.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-2 px-1 py-1 items-center">
                      <input
                        value={l.label}
                        onChange={(e) => updateLevel(i, { label: e.target.value })}
                        placeholder="A+"
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                      <input
                        value={l.minPercent}
                        onChange={(e) => updateLevel(i, { minPercent: e.target.value })}
                        type="number"
                        placeholder="90"
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-16"
                      />
                      <input
                        value={l.maxPercent}
                        onChange={(e) => updateLevel(i, { maxPercent: e.target.value })}
                        type="number"
                        placeholder="100"
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-16"
                      />
                      <input
                        value={l.description}
                        onChange={(e) => updateLevel(i, { description: e.target.value })}
                        placeholder="Outstanding"
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                      />
                      <button onClick={() => removeLevel(i)} className="text-red-400 text-xs">
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={addLevel} className="text-xs font-medium text-mega-blue mt-2">
                    + Add Grade Level
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- Step 5: Where it applies ---------- */}
      {step === 5 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Where should this apply?</h2>
          {!activeSession ? (
            <p className="text-sm text-slate-400">
              No active academic session — you can still create this assessment system and apply it later from Advanced management.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 mb-4">
              <button
                onClick={() => setApplyScope("WHOLE_GRADE")}
                className={`text-left border rounded-xl px-4 py-3 text-sm ${applyScope === "WHOLE_GRADE" ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
              >
                <span className="font-medium">This whole grade — every subject</span>
              </button>
              <button
                onClick={() => setApplyScope("ONE_SUBJECT")}
                className={`text-left border rounded-xl px-4 py-3 text-sm ${applyScope === "ONE_SUBJECT" ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
              >
                <span className="font-medium">Just one subject</span>
              </button>
              <button
                onClick={() => setApplyScope("SKIP")}
                className={`text-left border rounded-xl px-4 py-3 text-sm ${applyScope === "SKIP" ? "border-mega-navy bg-slate-50" : "border-slate-200"}`}
              >
                <span className="font-medium">Skip — I&apos;ll apply this later</span>
              </button>
            </div>
          )}

          {(applyScope === "WHOLE_GRADE" || applyScope === "ONE_SUBJECT") && (
            <div className="space-y-2">
              <select
                value={applyGradeId}
                onChange={(e) => {
                  setApplyGradeId(e.target.value);
                  setApplyGradeSubjectId("");
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Which class/grade?</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.displayName}
                  </option>
                ))}
              </select>
              {applyScope === "ONE_SUBJECT" && applyGradeId && (
                <select
                  value={applyGradeSubjectId}
                  onChange={(e) => setApplyGradeSubjectId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Which subject?</option>
                  {grades
                    .find((g) => g.id === applyGradeId)
                    ?.offeredSubjects.map((gs) => (
                      <option key={gs.id} value={gs.id}>
                        {gs.subjectName}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- Step 6: Review & confirm ---------- */}
      {step === 6 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Review your assessment system</h2>
          <p className="text-xs text-slate-400 mb-4">Nothing has been saved yet — check everything, then confirm below.</p>

          <div className="border border-slate-200 rounded-xl p-4 mb-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Name</p>
              <p className="font-medium text-slate-800">{name}</p>
              {description && <p className="text-slate-500 text-xs mt-0.5">{description}</p>}
            </div>
            <div>
              <p className="text-xs text-slate-400">Structure</p>
              <p className="text-slate-700">{usesPeriods ? periods.join(", ") : "One overall assessment"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Assessments</p>
              {periodGroups.map((group) => (
                <div key={group ?? "flat"} className="mb-1">
                  {group && <p className="text-xs font-semibold text-slate-600">{group}</p>}
                  {assessments
                    .filter((a) => a.periodName === group)
                    .map((a) => (
                      <p key={a.key} className="text-slate-700 text-xs">
                        {a.name} — {a.maxMarks} marks
                      </p>
                    ))}
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-slate-400">Results shown as</p>
              <p className="text-slate-700">{resultsChoiceSummary()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Applies to</p>
              <p className="text-slate-700">
                {applyScope === "SKIP" || !applyScope
                  ? "Not applied yet — you can apply it later"
                  : `${grades.find((g) => g.id === applyGradeId)?.displayName ?? ""} — ${
                      applyScope === "ONE_SUBJECT"
                        ? grades.find((g) => g.id === applyGradeId)?.offeredSubjects.find((s) => s.id === applyGradeSubjectId)?.subjectName
                        : "every subject"
                    }`}
              </p>
            </div>
          </div>

          {submitError && (
            <div className="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{submitError}</div>
          )}

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-mega-navy text-white text-sm font-semibold rounded-lg px-4 py-2.5 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Assessment System"}
          </button>
        </div>
      )}

      {/* ---------- Navigation ---------- */}
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? (
          <button onClick={() => setStep((s) => s - 1)} className="text-sm text-slate-500">
            ← Back
          </button>
        ) : (
          <Link href="/dashboard/assessment-frameworks" className="text-sm text-slate-500">
            Cancel
          </Link>
        )}
        {step < totalSteps && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="text-sm font-semibold text-mega-navy disabled:opacity-30"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
