"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type CarryForwardRow = { studentName: string; fromGrade: string; toGrade: string; decision: string };
type LeftRow = { studentName: string; fromGrade: string; decision: string };
type PendingRow = { studentName: string; fromGrade: string };

export default function NewSessionForm({
  schoolId,
  schoolName,
  priorSessionName,
  carryForward,
  leftOrTransferred,
  pending,
}: {
  schoolId: string;
  schoolName: string;
  priorSessionName: string;
  carryForward: CarryForwardRow[];
  leftOrTransferred: LeftRow[];
  pending: PendingRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  async function submit() {
    if (!name.trim() || !startDate || !endDate) {
      setError("Please fill in the session name and both dates.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/academic-sessions/rollover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    router.push("/dashboard/grades");
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/dashboard/grades" className="text-sm text-mega-blue font-medium">
        ← Grades &amp; Promotion
      </Link>
      <p className="text-sm text-slate-400 mt-3 mb-1">{schoolName}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Start a New Academic Session</h1>
      <p className="text-sm text-slate-500 mb-6">
        This will close <strong>{priorSessionName}</strong> and open a new session in its place.
        Here&apos;s what will happen to every student currently in {priorSessionName}:
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border border-green-200 bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-mega-green">{carryForward.length}</p>
          <p className="text-xs text-green-700">will continue automatically</p>
        </div>
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-600">{leftOrTransferred.length}</p>
          <p className="text-xs text-slate-500">left / transferred</p>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-700">{pending.length}</p>
          <p className="text-xs text-amber-700">pending — unresolved</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <p className="font-semibold mb-2">
            {pending.length} student{pending.length === 1 ? "" : "s"} will NOT get a grade in the new
            session yet:
          </p>
          <ul className="list-disc list-inside space-y-0.5 mb-2">
            {pending.map((p, i) => (
              <li key={i}>
                {p.studentName} — no decision recorded in {p.fromGrade}
              </li>
            ))}
          </ul>
          <p>
            They&apos;ll appear in the Pending/Unresolved queue on the Grades page after you start
            the new session — you can resolve each one there whenever you&apos;re ready. Starting
            the new session does not require resolving them first.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-mega-red text-sm rounded-lg px-4 py-2.5 mb-4">
          {error}
        </div>
      )}

      {!confirmStep ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New session name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2027-2028"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
          </div>
          <button
            onClick={() => {
              if (!name.trim() || !startDate || !endDate) {
                setError("Please fill in the session name and both dates.");
                return;
              }
              setError(null);
              setConfirmStep(true);
            }}
            className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition"
          >
            Review &amp; Confirm
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-sm text-slate-700">
            Close <strong>{priorSessionName}</strong> and start <strong>{name}</strong> (
            {startDate} – {endDate})? {carryForward.length} student(s) will be placed
            automatically.
          </p>
          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="bg-mega-green text-white font-semibold px-5 py-2.5 rounded-full hover:brightness-95 transition disabled:opacity-50"
            >
              {saving ? "Starting..." : "Start New Session"}
            </button>
            <button
              onClick={() => setConfirmStep(false)}
              className="text-slate-500 text-sm font-medium px-5 py-2.5"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
