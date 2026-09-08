"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["COMPLETED", "PARTIAL", "NOT_COMPLETED", "EXCUSED"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<Status, string> = {
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  NOT_COMPLETED: "Not Completed",
  EXCUSED: "Excused",
};

type StudentRow = {
  applicabilityId: string;
  studentId: string;
  studentName: string;
  status: Status | null;
  version: number | null;
  recordedAt: string | null;
  recordedByTeacherName: string | null;
  submissionCount: number;
  reviewCount: number;
};

type SaveSummary = { completedOk: number; completedFailed: number; reviewOk: number; reviewFailed: number };

type Rollup = {
  assigned: number;
  unrecorded: number;
  completed: number;
  partial: number;
  notCompleted: number;
  excused: number;
  completionPercentage: number | null;
};

export default function CompletionClient({
  schoolId,
  homeworkId,
  homework,
}: {
  schoolId: string;
  homeworkId: string;
  homework: {
    title: string;
    subjectName: string;
    gradeDisplayName: string;
    sectionName: string | null;
    targetStudentName: string | null;
    dueDate: string;
  };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [pending, setPending] = useState<Record<string, Status>>({});
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [saving, setSaving] = useState(false);

  // load() only ever refreshes server-derived state (rows/rollup) — it
  // deliberately never touches pending/reviewText/rowErrors/reviewErrors.
  // Those are managed explicitly by handleSave() below, which needs to
  // KEEP a failed row's pending selection (so the teacher can just click
  // Save again) while clearing only the rows that actually succeeded —
  // load() unconditionally clearing everything would silently discard
  // that "preserve failed selections" requirement the moment it re-runs
  // after a partially-failed save.
  async function load() {
    setLoadError(null);
    const res = await fetch(`/api/schools/${schoolId}/homework/${homeworkId}/completion`);
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error || "Something went wrong.");
      return;
    }
    setRows(data.students);
    setRollup(data.rollup);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, homeworkId]);

  function handleSelect(applicabilityId: string, status: Status) {
    setPending((p) => ({ ...p, [applicabilityId]: status }));
  }

  function handleReviewChange(applicabilityId: string, text: string) {
    setReviewText((p) => ({ ...p, [applicabilityId]: text }));
  }

  /**
   * One Save action persists two architecturally SEPARATE facts —
   * HomeworkCompletion (via the bulk completion endpoint) and, for any
   * row with review text typed in, a new HomeworkReview (via K4's
   * per-applicability reviews endpoint, called once per row with text —
   * there is no bulk reviews endpoint, and none is needed since writing
   * a review is comparatively rare per batch). The two are never merged
   * into one request or one database fact; the UI simply drives both
   * from the same button, exactly as approved.
   *
   * Every network/parse/non-2xx failure is caught here — `saving`
   * ALWAYS resets in the `finally` block below, regardless of how the
   * request failed, which is the direct fix for the bug where an empty/
   * non-JSON 500 response left the button stuck at "Saving...".
   */
  async function handleSave() {
    if (!rows) return;
    const completionEntries = Object.entries(pending);
    const reviewEntries = Object.entries(reviewText).filter(([, text]) => text.trim().length > 0);
    if (completionEntries.length === 0 && reviewEntries.length === 0) return;

    setSaving(true);
    setSaveError(null);
    setSaveSummary(null);

    try {
      let completedOk = 0;
      let completedFailed = 0;
      const nextRowErrors: Record<string, string> = {};
      const stillPending: Record<string, Status> = {};

      if (completionEntries.length > 0) {
        const records = completionEntries.map(([applicabilityId, status]) => {
          const row = rows.find((r) => r.applicabilityId === applicabilityId)!;
          return { applicabilityId, status, expectedVersion: row.version };
        });

        let data: { results?: { applicabilityId: string; ok: boolean; error?: string }[]; error?: unknown } | null = null;
        try {
          const res = await fetch(`/api/schools/${schoolId}/homework/${homeworkId}/completion`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records }),
          });
          if (!res.ok) {
            // A non-2xx response's body may not even be JSON (e.g. an
            // empty 500) — never assume res.json() is safe to call
            // without checking status first.
            let message = `The save request failed (HTTP ${res.status}).`;
            try {
              const errBody = await res.json();
              if (errBody?.error) message = typeof errBody.error === "string" ? errBody.error : JSON.stringify(errBody.error);
            } catch {
              // Body wasn't JSON — keep the generic HTTP-status message.
            }
            throw new Error(message);
          }
          data = await res.json();
        } catch (err) {
          // Network failure, or a thrown error from the block above —
          // treat the ENTIRE completion batch as failed, keep every
          // pending selection so the teacher can retry, and surface a
          // single clear message rather than silently losing the batch.
          for (const [applicabilityId, status] of completionEntries) stillPending[applicabilityId] = status;
          completedFailed = completionEntries.length;
          setSaveError(err instanceof Error ? err.message : "Could not reach the server — please try again.");
          data = null;
        }

        if (data?.results) {
          for (const outcome of data.results) {
            if (outcome.ok) {
              completedOk++;
            } else {
              completedFailed++;
              nextRowErrors[outcome.applicabilityId] = outcome.error || "Could not save.";
              const row = rows.find((r) => r.applicabilityId === outcome.applicabilityId);
              if (row) stillPending[outcome.applicabilityId] = pending[outcome.applicabilityId] ?? (row.status as Status);
            }
          }
        }
      }

      // Reviews — each row with typed text is its own independent
      // request; one review failing must never affect another review or
      // any completion outcome above.
      let reviewOk = 0;
      let reviewFailed = 0;
      const nextReviewErrors: Record<string, string> = {};
      const stillReviewText: Record<string, string> = {};

      if (reviewEntries.length > 0) {
        const settled = await Promise.allSettled(
          reviewEntries.map(([applicabilityId, feedback]) =>
            fetch(`/api/homework-applicability/${applicabilityId}/reviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ feedback, submissionAttemptId: null }),
            }).then(async (res) => {
              if (!res.ok) {
                let message = `Could not save this review (HTTP ${res.status}).`;
                try {
                  const errBody = await res.json();
                  if (errBody?.error) message = typeof errBody.error === "string" ? errBody.error : JSON.stringify(errBody.error);
                } catch {
                  // Body wasn't JSON — keep the generic message.
                }
                throw new Error(message);
              }
            })
          )
        );

        settled.forEach((outcome, i) => {
          const [applicabilityId, text] = reviewEntries[i];
          if (outcome.status === "fulfilled") {
            reviewOk++;
          } else {
            reviewFailed++;
            nextReviewErrors[applicabilityId] = outcome.reason instanceof Error ? outcome.reason.message : "Could not save this review.";
            stillReviewText[applicabilityId] = text;
          }
        });
      }

      setPending(stillPending);
      setRowErrors(nextRowErrors);
      setReviewText(stillReviewText);
      setReviewErrors(nextReviewErrors);
      setSaveSummary({ completedOk, completedFailed, reviewOk, reviewFailed });

      // Refresh server-derived state (rows/rollup/submissionCount/
      // reviewCount) so successful rows show their true persisted
      // status/version and review count immediately — never assume the
      // client's optimistic view is correct.
      await load();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = Object.keys(pending).length + Object.values(reviewText).filter((t) => t.trim().length > 0).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <a
        href={`/dashboard/schools/${schoolId}/homework`}
        className="text-sm text-mega-blue hover:underline mb-4 inline-block"
      >
        ← Back to Homework
      </a>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Record Completion</h1>
      <p className="text-sm text-slate-500 mb-1">
        {homework.title} — {homework.subjectName}
      </p>
      <p className="text-xs text-slate-400 mb-8">
        {homework.gradeDisplayName}{" "}
        {homework.targetStudentName
          ? `— Individual: ${homework.targetStudentName}`
          : homework.sectionName
          ? `— Section ${homework.sectionName}`
          : "— Whole Grade"}{" "}
        · Due {homework.dueDate}
      </p>

      {loadError && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6">{loadError}</p>
      )}

      {saveError && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6">{saveError}</p>
      )}

      {/* Save result — the teacher must never be left uncertain whether
          a batch actually saved. A fully successful save shows a plain
          confirmation with no error text left visible; a mixed result
          states exactly how many succeeded/failed for both Completion
          and Review, with the affected rows themselves also individually
          highlighted (and their selections preserved) below. */}
      {saveSummary && (
        (() => {
          const totalFailed = saveSummary.completedFailed + saveSummary.reviewFailed;
          const totalOk = saveSummary.completedOk + saveSummary.reviewOk;
          if (totalFailed === 0) {
            return totalOk > 0 ? (
              <p className="text-sm text-mega-green bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-6">
                Saved successfully.
              </p>
            ) : null;
          }
          return (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6">
              {saveSummary.completedOk + saveSummary.completedFailed > 0 &&
                `Completion: ${saveSummary.completedOk} saved, ${saveSummary.completedFailed} failed. `}
              {saveSummary.reviewOk + saveSummary.reviewFailed > 0 &&
                `Review: ${saveSummary.reviewOk} saved, ${saveSummary.reviewFailed} failed. `}
              See the highlighted student(s) below — their selections were kept so you can try again.
            </p>
          );
        })()
      )}

      {/* K5 — summary numbers, Regular Homework only. Individual
          Homework never gets a percentage (a single-target assignment
          has no meaningful class completion rate) — homework.
          targetStudentName already distinguishes the two above. */}
      {rollup && (
        <div className="border border-slate-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm text-slate-600">
            {rollup.assigned} assigned · {rollup.completed} completed · {rollup.partial} partial · {rollup.notCompleted} not
            completed · {rollup.excused} excused · {rollup.unrecorded} unrecorded
          </span>
          <span className="text-lg font-semibold text-mega-navy">
            {rollup.completionPercentage === null ? "N/A" : `${Math.round(rollup.completionPercentage)}%`}
          </span>
        </div>
      )}

      {!rows && !loadError && <p className="text-slate-400 text-sm">Loading…</p>}

      {rows && rows.length === 0 && <p className="text-slate-400 text-sm">No students applicable to this homework.</p>}

      {rows && rows.length > 0 && (
        <div className="space-y-2 mb-6">
          {rows.map((row) => {
            const currentValue = pending[row.applicabilityId] ?? row.status ?? "";
            const rowError = rowErrors[row.applicabilityId];
            const currentReviewText = reviewText[row.applicabilityId] ?? "";
            const reviewError = reviewErrors[row.applicabilityId];
            return (
              <div
                key={row.applicabilityId}
                className={`border rounded-lg px-4 py-3 ${
                  rowError || reviewError ? "border-mega-red bg-red-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{row.studentName}</p>
                    <p className="text-xs text-slate-400">
                      {row.status
                        ? `${STATUS_LABEL[row.status]} · recorded by ${row.recordedByTeacherName}`
                        : "Not yet recorded"}
                    </p>
                    {rowError && <p className="text-xs text-mega-red mt-1">{rowError}</p>}
                    <a
                      href={`/dashboard/schools/${schoolId}/homework/${homeworkId}/completion/${row.applicabilityId}`}
                      className="text-xs text-mega-blue hover:underline mt-1 inline-block"
                    >
                      {row.submissionCount > 0 ? `${row.submissionCount} submission(s)` : "No submission"}
                      {row.reviewCount > 0 ? ` · ${row.reviewCount} review(s)` : ""} · View full history
                    </a>
                  </div>
                  <select
                    value={currentValue}
                    onChange={(e) => handleSelect(row.applicabilityId, e.target.value as Status)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  >
                    <option value="" disabled>
                      Not yet recorded
                    </option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                {/* K4 — an optional, quick review alongside the
                    Completion decision, so the teacher doesn't need to
                    navigate to the detail page just to leave a short
                    piece of feedback. This is purely a UI convenience:
                    Save still persists Completion and Review as two
                    separate requests/facts — HomeworkCompletion is never
                    merged with HomeworkReview. The full history (all
                    past reviews, submission evidence) stays on the
                    linked detail page above. */}
                <div className="mt-2">
                  <textarea
                    value={currentReviewText}
                    onChange={(e) => handleReviewChange(row.applicabilityId, e.target.value)}
                    rows={1}
                    maxLength={4000}
                    placeholder="Review (optional) — write a short note for this student..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  {reviewError && <p className="text-xs text-mega-red mt-1">{reviewError}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows && rows.length > 0 && (
        <button
          onClick={handleSave}
          disabled={pendingCount === 0 || saving}
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {saving ? "Saving..." : pendingCount > 0 ? `Save (${pendingCount})` : "Save"}
        </button>
      )}
    </div>
  );
}
