import DashboardHero from "@/components/DashboardHero";

type SchoolLink = { school: { id: string; name: string } };
type OrgLink = { organization: { id: string; name: string } };

export default function AccountantDashboard({
  userName,
  schoolLinks,
  orgLinks,
}: {
  userName: string;
  schoolLinks: SchoolLink[];
  orgLinks: OrgLink[];
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle="Finance access — Accountant role"
        cards={[]}
      />

      <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-8">
        <p className="text-sm text-amber-800">
          Real payment processing isn&apos;t built yet, so there&apos;s no
          transaction data to show here yet. This confirms your finance
          access is correctly scoped — the actual finance features will
          appear here once payments are integrated.
        </p>
      </div>

      {schoolLinks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Schools</h2>
          <div className="space-y-2">
            {schoolLinks.map((l) => (
              <div key={l.school.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-800">{l.school.name}</p>
                <p className="text-xs text-slate-400">Finance access only — no admin permissions</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {orgLinks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Organizations</h2>
          <div className="space-y-2">
            {orgLinks.map((l) => (
              <div key={l.organization.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-800">{l.organization.name}</p>
                <p className="text-xs text-slate-400">Finance access only — no admin permissions</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
