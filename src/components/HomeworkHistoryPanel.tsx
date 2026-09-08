"use client";

import { useState } from "react";

export type HomeworkHistoryRow = {
  applicabilityId: string;
  homeworkId: string;
  title: string;
  instructions: string;
  subjectName: string;
  dueDate: string;
  isIndividual: boolean;
  status: "COMPLETED" | "PARTIAL" | "NOT_COMPLETED" | "EXCUSED" | null;
  submissionCount: number;
  latestAttemptLate: boolean;
  reviewCount: number;
};

type Attempt = {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  isLate: boolean;
  textContent: string | null;
  hasFile: boolean;
};

type Review = {
  id: string;
  reviewNumber: number;
  feedback: string;
  reviewedByTeacherName: string;
  reviewedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  NOT_COMPLETED: "Not Completed",
  EXCUSED: "Excused",
};

/**
 * K6 — "My Homework" history panel. Shared by the Student's own
 * dashboard and, once per linked child, the Parent dashboard — matching
 * TodaysHomeworkPanel's own "one component, every caller" discipline,
 * so the two views can never render this differently. `canSubmit`
 * gates the ONLY write affordance this component ever offers (the
 * submit form) — true for a Student viewing their own homework, false
 * for a Parent (who may only ever view: Homework, Completion, the full
 * Submission history, and Feedback — never submit, resubmit, alter
 * completion, or write feedback, per the approved K6 decision). The
 * underlying API routes enforce this same boundary independently — this
 * prop only controls whether the UI affordance is even shown.
 *
 * A row expands, on demand, to its full Submission/Review history —
 * fetched from the exact same
 * /api/homework-applicability/[id]/submissions and .../reviews routes
 * the Teacher's own completion detail page uses, so Student/Parent and
 * Teacher can never see a different shape of the same underlying facts.
 */
export default function HomeworkHistoryPanel({ rows, canSubmit }: { rows: HomeworkHistoryRow[]; canSubmit: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleExpand(applicabilityId: string) {
    if (expanded === applicabilityId) {
      setExpanded(null);
      return;
    }
    setExpanded(applicabilityId);
    setAttempts(null);
    setReviews(null);
    setError(null);
    const [subRes, revRes] = await Promise.all([
      fetch(`/api/homework-applicability/${applicabilityId}/submissions`),
      fetch(`/api/homework-applicability/${applicabilityId}/reviews`),
    ]);
    const subData = await subRes.json();
    const revData = await revRes.json();
    if (subRes.ok) setAttempts(subData.attempts);
    if (revRes.ok) setReviews(revData.reviews);
  }

  async function handleSubmit(applicabilityId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) {
      setError("Add text and/or a photo before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    if (text.trim()) form.set("text", text.trim());
    if (file) form.set("file", file);
    const res = await fetch(`/api/homework-applicability/${applicabilityId}/submissions`, { method: "POST", body: form });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setText("");
    setFile(null);
    await toggleExpand(applicabilityId); // collapses then re-fetches via the toggle below
    await toggleExpand(applicabilityId);
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">My Homework</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No homework history yet.</p>
      ) : (
        <div className="space-y-2 mt-3">
          {rows.map((row) => (
            <div key={row.applicabilityId} className="border border-slate-100 rounded-lg p-3">
              <button
                type="button"
                onClick={() => toggleExpand(row.applicabilityId)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold text-mega-navy">
                      {row.subjectName} {row.isIndividual ? "· Individual" : ""}
                    </p>
                    <p className="font-medium text-slate-800 text-sm">{row.title}</p>
                    <p className="text-xs text-slate-400">Due {row.dueDate}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      row.status ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {row.status ? STATUS_LABEL[row.status] : "Not yet recorded"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {row.submissionCount > 0 ? `${row.submissionCount} submission(s)` : "No submission"}
                  {row.latestAttemptLate ? " · Late" : ""}
                  {row.reviewCount > 0 ? ` · ${row.reviewCount} feedback` : ""}
                </p>
              </button>

              {expanded === row.applicabilityId && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{row.instructions}</p>

                  {!attempts || !reviews ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                  ) : (
                    <>
                      {attempts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Submission History</p>
                          <div className="space-y-1">
                            {attempts.map((a) => (
                              <div key={a.id} className="text-xs text-slate-600 border border-slate-100 rounded px-2 py-1.5">
                                Attempt {a.attemptNumber} — {new Date(a.submittedAt).toLocaleString()}
                                {a.isLate ? " (Late)" : ""}
                                {a.textContent && <p className="mt-1 whitespace-pre-wrap">{a.textContent}</p>}
                                {a.hasFile && (
                                  <img
                                    src={`/api/homework-submissions/${a.id}/file`}
                                    alt={`Attempt ${a.attemptNumber} evidence`}
                                    className="mt-1 max-h-40 rounded border border-slate-100"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reviews.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Teacher Feedback</p>
                          <div className="space-y-1">
                            {reviews.map((r) => (
                              <div key={r.id} className="text-xs text-slate-700 border border-slate-100 rounded px-2 py-1.5">
                                <span className="font-medium">{r.reviewedByTeacherName}</span> —{" "}
                                {new Date(r.reviewedAt).toLocaleString()}
                                <p className="mt-1 whitespace-pre-wrap">{r.feedback}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {canSubmit && (
                        <form onSubmit={(e) => handleSubmit(row.applicabilityId, e)} className="space-y-2">
                          <p className="text-xs font-semibold text-slate-500">
                            {attempts.length > 0 ? "Submit Another Attempt" : "Submit"}
                          </p>
                          <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={2}
                            placeholder="Add a note (optional if attaching a photo)..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-mega-blue"
                          />
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            className="text-xs"
                          />
                          {error && <p className="text-xs text-mega-red">{error}</p>}
                          <button
                            type="submit"
                            disabled={submitting}
                            className="bg-mega-navy text-white font-semibold px-4 py-1.5 rounded-full text-xs hover:bg-mega-blue transition disabled:opacity-50"
                          >
                            {submitting ? "Submitting..." : "Submit"}
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
