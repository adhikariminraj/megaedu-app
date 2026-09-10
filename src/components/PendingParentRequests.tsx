"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PendingParentRequest = {
  id: string;
  parentName: string;
  parentEmail: string;
};

/**
 * Parent-Student Linking Trust Boundary kilometer — the Student's own
 * action surface for a pending ParentStudent request. Deliberately not
 * derived from the Notification record (which has no structured
 * payload to link back to a specific request) — reads/acts on
 * ParentStudent directly, the single source of truth.
 */
export default function PendingParentRequests({ requests }: { requests: PendingParentRequest[] }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function respond(id: string, action: "confirm" | "decline") {
    setPendingAction(id);
    setError(null);
    const res = await fetch(
      action === "confirm" ? `/api/parent-student/${id}/confirm` : `/api/parent-student/${id}`,
      { method: action === "confirm" ? "POST" : "DELETE" }
    );
    setPendingAction(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border border-mega-blue bg-blue-50/40 rounded-xl p-5 mb-6 space-y-3">
      <h2 className="font-semibold text-slate-800">Parent Requests</h2>
      {error && <p className="text-sm text-mega-red">{error}</p>}
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{r.parentName}</p>
            <p className="text-xs text-slate-400">{r.parentEmail} wants to link as your parent.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => respond(r.id, "confirm")}
              disabled={pendingAction === r.id}
              className="bg-mega-green text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:brightness-95 transition disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => respond(r.id, "decline")}
              disabled={pendingAction === r.id}
              className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-slate-200 transition disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
