"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHero from "@/components/DashboardHero";

type School = { schoolId: string; schoolName: string };

/**
 * Shown only when a person has 2+ ACTIVE institutional relationships
 * for this role and no valid remembered-school cookie already
 * resolved one. Selecting a school persists it as a preference (never
 * a grant — see /api/dashboard/school-context) and navigates into its
 * URL-scoped context, which independently re-verifies access.
 */
export default function SchoolChooser({
  schools,
  userName,
  redirectTo,
}: {
  schools: School[];
  userName: string;
  // Phase 4D-4: callers using the URL-scoped pattern (schools/[schoolId]/...)
  // leave this unset and keep the existing per-school destination;
  // callers using the same-URL pattern (e.g. /dashboard/grades) pass
  // their own path so re-visiting it now resolves via the
  // just-set cookie instead of an arbitrary pick.
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function choose(schoolId: string) {
    setPending(schoolId);
    await fetch("/api/dashboard/school-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    router.push(redirectTo ?? `/dashboard/schools/${schoolId}`);
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <DashboardHero name={userName} subtitle="Choose which school you'd like to work in." cards={[]} />
      <div className="space-y-2">
        {schools.map((s) => (
          <button
            key={s.schoolId}
            onClick={() => choose(s.schoolId)}
            disabled={pending !== null}
            className="w-full text-left border border-slate-200 rounded-xl px-4 py-3 hover:border-mega-navy transition disabled:opacity-50"
          >
            <span className="font-medium text-slate-800">{s.schoolName}</span>
            {pending === s.schoolId && <span className="text-xs text-slate-400 ml-2">Opening…</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
