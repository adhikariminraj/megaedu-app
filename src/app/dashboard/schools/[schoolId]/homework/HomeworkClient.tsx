"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AssignmentOption = {
  key: string;
  schoolGradeId: string;
  gradeDisplayName: string;
  gradeSubjectId: string;
  subjectName: string;
  sectionId: string | null;
  sectionName: string | null;
  students: { id: string; name: string }[];
};

type HomeworkRow = {
  id: string;
  gradeDisplayName: string;
  sectionName: string | null;
  subjectName: string;
  teacherName: string;
  title: string;
  instructions: string;
  dueDate: string;
  status: "DRAFT" | "PUBLISHED";
  targetStudentName: string | null;
};

export default function HomeworkClient({
  schoolId,
  isAdmin,
  assignmentOptions,
  homework,
}: {
  schoolId: string;
  isAdmin: boolean;
  assignmentOptions: AssignmentOption[];
  homework: HomeworkRow[];
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(assignmentOptions[0]?.key ?? "");
  const [assignMode, setAssignMode] = useState<"SECTION" | "INDIVIDUAL">("SECTION");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const selectedOption = assignmentOptions.find((o) => o.key === selectedKey);

  function handleOptionChange(key: string) {
    setSelectedKey(key);
    // A different scope has a different roster — an Individual target
    // picked under the previous scope may not even apply here.
    setTargetStudentId("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const option = assignmentOptions.find((o) => o.key === selectedKey);
    if (!option) {
      setError("Choose a grade/subject/section.");
      return;
    }
    if (assignMode === "INDIVIDUAL" && !targetStudentId) {
      setError("Choose which student this individual homework is for.");
      return;
    }
    if (!title.trim() || !instructions.trim() || !dueDate) {
      setError("Title, instructions, and due date are all required.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/schools/${schoolId}/homework`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolGradeId: option.schoolGradeId,
        sectionId: option.sectionId,
        gradeSubjectId: option.gradeSubjectId,
        title,
        instructions,
        dueDate,
        targetStudentId: assignMode === "INDIVIDUAL" ? targetStudentId : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error?.formErrors?.[0] || data.error || "Something went wrong.");
      return;
    }
    setTitle("");
    setInstructions("");
    setDueDate("");
    setAssignMode("SECTION");
    setTargetStudentId("");
    router.refresh();
  }

  async function handlePublish(homeworkId: string) {
    setPublishingId(homeworkId);
    const res = await fetch(`/api/schools/${schoolId}/homework/${homeworkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    setPublishingId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Homework</h1>
      {/* K5 — Class Teacher/Grade Coordinator progress view. Teacher-only
          (the page itself redirects Admin); shown unconditionally to
          every teacher rather than passing a new server-computed flag
          down just for link visibility — the page handles "you hold no
          such assignment" gracefully on its own. */}
      <p className="mb-8">
        {!isAdmin && (
          <a href={`/dashboard/schools/${schoolId}/homework/progress`} className="text-sm text-mega-blue hover:underline">
            View Homework Progress →
          </a>
        )}
      </p>

      {assignmentOptions.length === 0 ? (
        <p className="text-slate-400 text-sm mb-8">
          {isAdmin
            ? "No subjects are offered yet this session."
            : "You aren't assigned to teach any subject this session."}
        </p>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4 border border-slate-200 rounded-xl p-5 mb-10">
          <h2 className="font-semibold text-slate-800">New Homework (Draft)</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grade / Subject / Section</label>
            <select
              value={selectedKey}
              onChange={(e) => handleOptionChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-mega-blue"
            >
              {assignmentOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.gradeDisplayName} — {o.subjectName} — {o.sectionName ? `Section ${o.sectionName}` : "Whole Grade"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to</label>
            <div className="flex gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="assignMode"
                  checked={assignMode === "SECTION"}
                  onChange={() => {
                    setAssignMode("SECTION");
                    setTargetStudentId("");
                  }}
                />
                Entire Section
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="assignMode"
                  checked={assignMode === "INDIVIDUAL"}
                  onChange={() => setAssignMode("INDIVIDUAL")}
                />
                Individual Student
              </label>
            </div>
            {assignMode === "INDIVIDUAL" && (
              <select
                value={targetStudentId}
                onChange={(e) => setTargetStudentId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-mega-blue mt-2"
              >
                <option value="">Choose a student…</option>
                {(selectedOption?.students ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>

          {error && (
            <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as Draft"}
          </button>
        </form>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">{isAdmin ? "All Homework" : "Your Homework"}</h2>
      {homework.length === 0 ? (
        <p className="text-slate-400 text-sm">No homework yet.</p>
      ) : (
        <div className="space-y-3">
          {homework.map((hw) => (
            <div key={hw.id} className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800">{hw.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hw.gradeDisplayName}{" "}
                    {hw.targetStudentName
                      ? `— Individual: ${hw.targetStudentName}`
                      : hw.sectionName
                      ? `— Section ${hw.sectionName}`
                      : "— Whole Grade"}{" "}
                    · {hw.subjectName}
                    {isAdmin ? ` · ${hw.teacherName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">Due {hw.dueDate}</span>
                  <span
                    className={`text-xs font-semibold rounded-full px-3 py-1 ${
                      hw.status === "DRAFT" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {hw.status === "DRAFT" ? "Draft" : "Published"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{hw.instructions}</p>
              {hw.status === "DRAFT" && (
                <button
                  onClick={() => handlePublish(hw.id)}
                  disabled={publishingId === hw.id}
                  className="mt-4 text-xs font-semibold bg-mega-navy text-white rounded-full px-4 py-1.5 hover:bg-mega-blue transition disabled:opacity-50"
                >
                  {publishingId === hw.id ? "Publishing..." : "Publish"}
                </button>
              )}
              {/* K2 — Teacher-only: School Admin has no authority over
                  individual Homework completion, so this link is
                  deliberately omitted from the Admin view rather than
                  shown and then always rejected server-side. */}
              {hw.status === "PUBLISHED" && !isAdmin && (
                <a
                  href={`/dashboard/schools/${schoolId}/homework/${hw.id}/completion`}
                  className="mt-4 inline-block text-xs font-semibold border border-mega-navy text-mega-navy rounded-full px-4 py-1.5 hover:bg-mega-navy hover:text-white transition"
                >
                  Record Completion
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
