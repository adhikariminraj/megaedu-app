"use client";

import { useEffect, useState } from "react";

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
  submissionAttemptId: string | null;
};

export default function StudentDetailClient({
  schoolId,
  homeworkId,
  applicabilityId,
  studentName,
  homeworkTitle,
  subjectName,
}: {
  schoolId: string;
  homeworkId: string;
  applicabilityId: string;
  studentName: string;
  homeworkTitle: string;
  subjectName: string;
}) {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [feedback, setFeedback] = useState("");
  const [linkedAttemptId, setLinkedAttemptId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [subRes, revRes] = await Promise.all([
      fetch(`/api/homework-applicability/${applicabilityId}/submissions`),
      fetch(`/api/homework-applicability/${applicabilityId}/reviews`),
    ]);
    const subData = await subRes.json();
    const revData = await revRes.json();
    if (subRes.ok) setAttempts(subData.attempts);
    if (revRes.ok) setReviews(revData.reviews);
    if (!subRes.ok) setError(subData.error || "Could not load submissions.");
    else if (!revRes.ok) setError(revData.error || "Could not load reviews.");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicabilityId]);

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/homework-applicability/${applicabilityId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback, submissionAttemptId: linkedAttemptId || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error?.formErrors?.[0] || data.error || "Something went wrong.");
      return;
    }
    setFeedback("");
    setLinkedAttemptId("");
    await load();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <a
        href={`/dashboard/schools/${schoolId}/homework/${homeworkId}/completion`}
        className="text-sm text-mega-blue hover:underline mb-4 inline-block"
      >
        ← Back to Record Completion
      </a>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{studentName}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {homeworkTitle} — {subjectName}
      </p>

      {error && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6">{error}</p>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">Submission History</h2>
      {!attempts ? (
        <p className="text-slate-400 text-sm mb-8">Loading…</p>
      ) : attempts.length === 0 ? (
        <p className="text-slate-400 text-sm mb-8">No online submission yet — this homework may be checked offline.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {attempts.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">Attempt {a.attemptNumber}</span>
                <span className="text-xs text-slate-400">
                  {new Date(a.submittedAt).toLocaleString()}
                  {a.isLate ? " · Late" : ""}
                </span>
              </div>
              {a.textContent && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{a.textContent}</p>}
              {a.hasFile && (
                <img
                  src={`/api/homework-submissions/${a.id}/file`}
                  alt={`Attempt ${a.attemptNumber} evidence`}
                  className="mt-2 max-h-64 rounded-lg border border-slate-100"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">Teacher Review / Feedback</h2>
      {!reviews ? (
        <p className="text-slate-400 text-sm mb-6">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No feedback given yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {reviews.map((r) => (
            <div key={r.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-mega-navy">Review {r.reviewNumber}</span>
                <span className="text-xs text-slate-400">
                  {r.reviewedByTeacherName} · {new Date(r.reviewedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{r.feedback}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmitFeedback} className="space-y-3 border border-slate-200 rounded-xl p-4">
        <label className="block text-sm font-medium text-slate-700">Add Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          maxLength={4000}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          placeholder="Write feedback for this student..."
        />
        {attempts && attempts.length > 0 && (
          <select
            value={linkedAttemptId}
            onChange={(e) => setLinkedAttemptId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Not linked to a specific attempt</option>
            {attempts.map((a) => (
              <option key={a.id} value={a.id}>
                Re: Attempt {a.attemptNumber}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={saving || !feedback.trim()}
          className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-mega-blue transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Feedback"}
        </button>
      </form>
    </div>
  );
}
