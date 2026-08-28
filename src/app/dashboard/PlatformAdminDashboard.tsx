"use client";

import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import VerifyButton from "@/app/admin/schools/VerifyButton";
import VerifyOrgButton from "@/app/admin/organizations/VerifyOrgButton";

type PendingSchool = {
  id: string;
  name: string;
  location: string | null;
  createdAt: string | Date;
  admins: { user: { name: string; email: string } }[];
};

type PendingOrganization = {
  id: string;
  name: string;
  createdAt: string | Date;
  admins: { user: { name: string; email: string } }[];
};

type RoleCount = { role: string; count: number };

type Stats = {
  schools: { total: number; verified: number; pending: number; active: number };
  organizations: { total: number; verified: number; pending: number; active: number };
  teachers: { total: number; approved: number; pending: number };
  students: { total: number; approved: number; pending: number };
  courses: { total: number; published: number; unpublished: number };
  certificates: { total: number };
  users: { total: number; byRole: RoleCount[] };
};

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform Admins",
  SCHOOL_ADMIN: "School Admins",
  TEACHER: "Teachers",
  STUDENT: "Students",
  PARENT: "Parents",
  ORGANIZATION_ADMIN: "Organization Admins",
  ACCOUNTANT: "Accountants",
};

function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <p className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
      <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PlatformAdminDashboard({
  userName,
  stats,
  pendingSchools,
  pendingOrganizations,
}: {
  userName: string;
  stats: Stats;
  pendingSchools: PendingSchool[];
  pendingOrganizations: PendingOrganization[];
}) {
  const heroCards: HeroCard[] = [
    {
      icon: "🏫",
      title: `${stats.schools.pending} school${stats.schools.pending === 1 ? "" : "s"} pending verification`,
      description:
        stats.schools.pending > 0
          ? "Registered schools waiting for review before they go public."
          : "Nothing pending — all caught up.",
      href: "/admin/schools",
      cta: "Review queue",
      accent: stats.schools.pending > 0 ? "red" : "green",
    },
    {
      icon: "🏢",
      title: `${stats.organizations.pending} organization${stats.organizations.pending === 1 ? "" : "s"} pending verification`,
      description:
        stats.organizations.pending > 0
          ? "Registered organizations waiting for review before they can publish courses."
          : "Nothing pending — all caught up.",
      href: "/admin/organizations",
      cta: "Review queue",
      accent: stats.organizations.pending > 0 ? "red" : "green",
    },
    {
      icon: "🎓",
      title: `${stats.certificates.total} certificate${stats.certificates.total === 1 ? "" : "s"} issued`,
      description: "Total certificates issued across MEGA.EDU, schools, and organizations.",
      accent: "gold",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <DashboardHero
        name={userName}
        title="MEGA.EDU Platform Administration"
        subtitle="Command Center for schools, organizations, learners and learning."
        cards={heroCards}
      />

      <section className="mb-10">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Platform overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label="Schools"
            value={stats.schools.total}
            sublabel={`${stats.schools.verified} verified · ${stats.schools.active} active`}
          />
          <StatTile
            label="Organizations"
            value={stats.organizations.total}
            sublabel={`${stats.organizations.verified} verified · ${stats.organizations.active} active`}
          />
          <StatTile
            label="Teachers"
            value={stats.teachers.total}
            sublabel={`${stats.teachers.approved} approved · ${stats.teachers.pending} pending`}
          />
          <StatTile
            label="Students"
            value={stats.students.total}
            sublabel={`${stats.students.approved} approved · ${stats.students.pending} pending`}
          />
          <StatTile
            label="Courses"
            value={stats.courses.total}
            sublabel={`${stats.courses.published} published · ${stats.courses.unpublished} unpublished`}
          />
          <StatTile label="Certificates issued" value={stats.certificates.total} />
          <StatTile label="MEGA IDs (total users)" value={stats.users.total} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Schools awaiting verification</h2>
            <a href="/admin/schools" className="text-xs font-semibold text-mega-navy">
              View all →
            </a>
          </div>
          {pendingSchools.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing pending — all caught up.</p>
          ) : (
            <div className="space-y-3">
              {pendingSchools.map((school) => (
                <div
                  key={school.id}
                  className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{school.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {school.location || "No location set"} · Registered{" "}
                      {formatDate(school.createdAt)}
                      {school.admins[0] && ` by ${school.admins[0].user.name}`}
                    </p>
                  </div>
                  <VerifyButton schoolId={school.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Organizations awaiting verification</h2>
            <a href="/admin/organizations" className="text-xs font-semibold text-mega-navy">
              View all →
            </a>
          </div>
          {pendingOrganizations.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing pending — all caught up.</p>
          ) : (
            <div className="space-y-3">
              {pendingOrganizations.map((org) => (
                <div
                  key={org.id}
                  className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{org.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      Registered {formatDate(org.createdAt)}
                      {org.admins[0] && ` by ${org.admins[0].user.name}`}
                    </p>
                  </div>
                  <VerifyOrgButton orgId={org.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">MEGA IDs by role</h2>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {stats.users.byRole.map((r) => (
              <div key={r.role} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700">{ROLE_LABELS[r.role] || r.role}</span>
                <span className="text-sm font-semibold text-slate-800">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Platform Insights</h2>
          <div className="border border-dashed border-slate-300 rounded-xl p-4">
            <p className="text-sm text-slate-500 mb-2">
              Additional analytics will be added here once the underlying data
              is reliably available:
            </p>
            <ul className="text-sm text-slate-500 list-disc list-inside space-y-1">
              <li>Platform revenue &amp; payments (payment processing isn&apos;t live yet)</li>
              <li>Growth trends over time (no historical snapshots recorded)</li>
              <li>User management &amp; moderation actions (no admin API for this yet)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
