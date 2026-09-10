import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true, verified: true, isActive: true },
  });
  if (!organization || !organization.verified || !organization.isActive) {
    return { title: "Organization not found — MEGA.EDU" };
  }
  return {
    title: `${organization.name} — MEGA.EDU`,
    description: organization.description?.slice(0, 160) || `${organization.name} on MEGA.EDU.`,
  };
}

export default async function OrganizationProfilePage({ params }: { params: { slug: string } }) {
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    include: {
      // Provider Profile kilometer — course eligibility for THIS page is
      // published && verified && academyParticipant, matching the
      // approved read-time condition. `verified` is already re-checked
      // below (guards the whole page); `academyParticipant` gates
      // whether this include is even rendered (see below) rather than
      // being repeated in the where-clause here.
      courses: { where: { published: true }, orderBy: { createdAt: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" }, take: 5 },
      // A7 — capped at 5, matching the Opportunities sidebar's existing
      // convention. Active events only (isActive: true), matching School
      // Event's own display rule. Gated only by this page's existing
      // verified && isActive guard below — never by academyParticipant,
      // which is specific to MEGA Academy course eligibility and has no
      // bearing on an Organization's general institutional presence.
      events: { where: { isActive: true }, orderBy: { startsAt: "asc" }, take: 5 },
      resources: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  // Enforced here directly, not only by the /organizations directory's
  // own filtering — a slug is guessable/shareable, so an unverified or
  // deactivated organization must not remain reachable simply because
  // someone knows its URL. Mirrors /schools/[slug]'s identical guard.
  if (!organization || !organization.verified || !organization.isActive) notFound();

  return (
    <div>
      <div className="bg-mega-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center gap-5">
            <Avatar src={organization.logoUrl} name={organization.name} variant="school" size="xl" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{organization.name}</h1>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-3 py-1">
                  ✓ Verified Organization
                </span>
                {organization.academyParticipant && (
                  <span className="text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-3 py-1">
                    ✓ MEGA Academy Provider
                  </span>
                )}
              </div>
            </div>
          </div>
          {organization.website && (
            <Link
              href={organization.website}
              target="_blank"
              className="inline-block text-sm text-slate-300 mt-4 underline underline-offset-2"
            >
              Visit website →
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-10">
          {organization.description && (
            <section>
              <h2 className="text-xl font-semibold text-slate-800 mb-3">About</h2>
              <p className="text-slate-600 leading-relaxed">{organization.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">MEGA Academy</h2>
            {organization.academyParticipant ? (
              organization.courses.length === 0 ? (
                <p className="text-slate-400 text-sm">No courses published yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {organization.courses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.slug}`}
                      className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
                    >
                      <h3 className="font-semibold text-slate-800">{c.title}</h3>
                      {c.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <span className="text-sm font-semibold text-mega-navy mt-3 inline-block">
                        {c.priceCents === 0 ? "Free" : `NPR ${(c.priceCents / 100).toFixed(0)}`}
                      </span>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              <p className="text-slate-400 text-sm">
                Not currently offering courses on MEGA Academy.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Upcoming Events</h2>
            {organization.events.length === 0 ? (
              <p className="text-slate-400 text-sm">No events posted yet.</p>
            ) : (
              <div className="space-y-3">
                {organization.events.map((ev) => (
                  <div key={ev.id} className="border border-slate-200 rounded-xl p-4">
                    <p className="font-medium text-slate-800">{ev.title}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", dateStyle: "medium" }).format(
                        new Date(ev.startsAt)
                      )}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                    {ev.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{ev.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Opportunities</h3>
            {organization.opportunities.length === 0 ? (
              <p className="text-sm text-slate-400">No opportunities posted yet.</p>
            ) : (
              <ul className="space-y-3">
                {organization.opportunities.map((o) => (
                  <li key={o.id} className="text-sm">
                    <span className="text-xs font-semibold text-mega-purple bg-purple-50 rounded-full px-2 py-0.5">
                      {o.type}
                    </span>
                    <p className="font-medium text-slate-800 mt-1">{o.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Resources</h3>
            {organization.resources.length === 0 ? (
              <p className="text-sm text-slate-400">No resources posted yet.</p>
            ) : (
              <ul className="space-y-3">
                {organization.resources.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="font-medium text-slate-800">{r.title}</p>
                    {(r.subject || r.gradeLevel) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[r.subject, r.gradeLevel].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
