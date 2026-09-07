"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Eligibility =
  | {
      eligible: true;
      schoolName: string;
      sessionName: string;
      gradeDisplayName: string;
      sectionName: string | null;
      outcomeStatus: string;
      subjectCount: number;
      gpa: number | null;
    }
  | { eligible: false; reason: string };

type VersionRow = {
  id: string;
  version: number;
  status: string;
  issuedAt: string;
  issuerNameSnapshot: string;
  correctionReason: string | null;
};

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: "Promoted",
  REPEATED: "Repeating (Not Promoted)",
  TRANSFERRED: "Transferred",
  LEFT: "Left the school",
};

export default function MarkSheetIssuance({
  schoolId,
  studentId,
  isAdmin,
  eligibility,
  versions,
}: {
  schoolId: string;
  studentId: string;
  isAdmin: boolean;
  eligibility: Eligibility;
  versions: VersionRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showCorrectForm, setShowCorrectForm] = useState(false);

  const current = versions.find((v) => v.status === "ISSUED");
  const history = versions.filter((v) => v.status !== "ISSUED");

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schools/${schoolId}/mark-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not issue the Mark Sheet.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function correct() {
    if (!current || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schools/${schoolId}/mark-sheets/${current.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create a corrected version.");
        return;
      }
      setReason("");
      setShowCorrectForm(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {current && (
        <div className="border border-mega-green/40 bg-green-50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-800">Issued — Version {current.version}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">ISSUED</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">
            Issued {new Date(current.issuedAt).toLocaleDateString()} by {current.issuerNameSnapshot}
          </p>
          {current.correctionReason && (
            <p className="text-sm text-slate-600 mb-3">
              This version corrects the prior one — reason: {current.correctionReason}
            </p>
          )}
          <Link
            href={`/dashboard/mark-sheet/${studentId}/${current.id}`}
            className="text-mega-blue font-medium text-sm"
          >
            View Mark Sheet →
          </Link>
        </div>
      )}

      {!current && eligibility.eligible && (
        <div className="border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Ready to Issue</h3>
          <dl className="text-sm text-slate-600 space-y-1 mb-4">
            <div><dt className="inline text-slate-400">School: </dt><dd className="inline">{eligibility.schoolName}</dd></div>
            <div><dt className="inline text-slate-400">Session: </dt><dd className="inline">{eligibility.sessionName}</dd></div>
            <div><dt className="inline text-slate-400">Grade: </dt><dd className="inline">{eligibility.gradeDisplayName}{eligibility.sectionName ? ` — Section ${eligibility.sectionName}` : ""}</dd></div>
            <div><dt className="inline text-slate-400">Final Result: </dt><dd className="inline">{OUTCOME_LABELS[eligibility.outcomeStatus] ?? eligibility.outcomeStatus}</dd></div>
            <div><dt className="inline text-slate-400">Subjects: </dt><dd className="inline">{eligibility.subjectCount} published</dd></div>
            {typeof eligibility.gpa === "number" && (
              <div><dt className="inline text-slate-400">GPA: </dt><dd className="inline">{eligibility.gpa.toFixed(2)}</dd></div>
            )}
          </dl>
          {isAdmin ? (
            <button
              onClick={issue}
              disabled={busy}
              className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {busy ? "Issuing…" : "Issue Mark Sheet"}
            </button>
          ) : (
            <p className="text-xs text-slate-400">Only a School Admin can issue this Mark Sheet.</p>
          )}
        </div>
      )}

      {!current && !eligibility.eligible && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Not Yet Eligible</h3>
          <p className="text-sm text-amber-700">{eligibility.reason}</p>
        </div>
      )}

      {isAdmin && current && (
        <div className="border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Correction / Reissue</h3>
          <p className="text-xs text-slate-400 mb-3">
            The issued document is never edited in place. A correction creates a new version from the current
            results and marks this one superseded — the original stays permanently retrievable.
          </p>
          {!showCorrectForm ? (
            <button
              onClick={() => setShowCorrectForm(true)}
              className="text-mega-blue text-sm font-medium"
            >
              Create a corrected version →
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for this correction (required)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={correct}
                  disabled={busy || !reason.trim()}
                  className="bg-mega-blue text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create Corrected Version"}
                </button>
                <button
                  onClick={() => { setShowCorrectForm(false); setReason(""); }}
                  className="text-slate-500 text-sm px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-mega-red">{error}</p>}

      {history.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Correction History</h3>
          <div className="space-y-2">
            {history.map((v) => (
              <div key={v.id} className="text-sm border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Version {v.version}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">SUPERSEDED</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Issued {new Date(v.issuedAt).toLocaleDateString()} by {v.issuerNameSnapshot}
                  {" — "}superseded by Version {v.version + 1}
                </p>
                <Link href={`/dashboard/mark-sheet/${studentId}/${v.id}`} className="text-xs text-mega-blue font-medium mt-1 inline-block">
                  View this version →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
