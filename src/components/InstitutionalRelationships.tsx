import { formatRelationshipPeriod, type InstitutionalRelationship } from "@/lib/profile";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  ENDED: "bg-slate-100 text-slate-500",
};

/**
 * My Profile K1 — "My Institutional Relationships". Purely
 * presentational: receives an already-built, already-self-scoped
 * relationship list (src/lib/profile.ts, fed from the session's own
 * Teacher/Student/SchoolAdmin relations) and renders it. No fetching,
 * no authorization decision of its own.
 *
 * ENDED relationships are visually receded (grayed, reduced opacity) —
 * never styled like a current affiliation — but are never hidden:
 * historical institutional relationships are part of a person's real
 * MEGA history, not something to erase because it's no longer active.
 */
export default function InstitutionalRelationships({
  relationships,
  hasSchoolAdminRows,
}: {
  relationships: InstitutionalRelationship[];
  hasSchoolAdminRows: boolean;
}) {
  if (relationships.length === 0) {
    return <p className="text-sm text-slate-400">No institutional relationships recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {relationships.map((r) => {
        const isEnded = r.status === "ENDED";
        return (
          <div
            key={r.id}
            className={`border rounded-lg px-4 py-3 ${
              isEnded ? "border-slate-100 opacity-60" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={`font-medium ${isEnded ? "text-slate-500" : "text-slate-800"}`}>
                {r.institutionName}
              </p>
              {r.status && (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-0.5 shrink-0 ${STATUS_BADGE[r.status]}`}
                >
                  {r.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{r.role}</p>
            <p className={`text-xs mt-1 ${isEnded ? "text-slate-400" : "text-slate-500"}`}>
              {formatRelationshipPeriod(r)}
            </p>
          </div>
        );
      })}

      {hasSchoolAdminRows && (
        <p className="text-[11px] text-slate-400 pt-1">
          School Admin relationships don&apos;t yet track historical join/leave dates — only the
          current relationship is shown.
        </p>
      )}
    </div>
  );
}
