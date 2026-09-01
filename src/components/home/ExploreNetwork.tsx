import Link from "next/link";
import Avatar from "@/components/Avatar";

type SchoolCard = { id: string; slug: string; name: string; location: string | null; logoUrl: string | null };
type CourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  organization: { name: string } | null;
  approach: { name: string } | null;
};
type OpportunityCard = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  school: { name: string } | null;
  organization: { name: string } | null;
};
type ApproachCard = { id: string; slug: string; name: string; description: string | null };

export default function ExploreNetwork({
  schools,
  courses,
  opportunities,
  approaches,
}: {
  schools: SchoolCard[];
  courses: CourseCard[];
  opportunities: OpportunityCard[];
  approaches: ApproachCard[];
}) {
  const hasAny = schools.length > 0 || courses.length > 0 || opportunities.length > 0 || approaches.length > 0;
  if (!hasAny) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold text-slate-800 text-center mb-12">Explore the Network</h2>

      {schools.length > 0 && (
        <div className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Recently joined schools</h3>
            <Link href="/schools" className="text-sm text-mega-blue font-medium">
              See all schools →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {schools.map((s) => (
              <Link
                key={s.id}
                href={`/schools/${s.slug}`}
                className="flex items-start gap-3 border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
              >
                <Avatar src={s.logoUrl} name={s.name} variant="school" />
                <div>
                  <h4 className="font-semibold text-slate-800">{s.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{s.location || "Nepal"}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {courses.length > 0 && (
        <div className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Courses</h3>
            <Link href="/courses" className="text-sm text-mega-blue font-medium">
              See all courses →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
              >
                <h4 className="font-semibold text-slate-800">{c.title}</h4>
                {c.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-slate-400">{c.organization?.name}</span>
                  <span className="text-sm font-semibold text-mega-navy">
                    {c.priceCents === 0 ? "Free" : `NPR ${(c.priceCents / 100).toFixed(0)}`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Opportunities</h3>
            <Link href="/opportunities" className="text-sm text-mega-blue font-medium">
              See all opportunities →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {opportunities.map((o) => (
              <div key={o.id} className="border border-slate-200 rounded-xl p-5">
                <span className="text-xs font-semibold text-mega-purple bg-purple-50 rounded-full px-2.5 py-1">
                  {o.type}
                </span>
                <h4 className="font-semibold text-slate-800 mt-2">{o.title}</h4>
                <p className="text-xs text-slate-400 mt-2">
                  {o.school?.name || o.organization?.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {approaches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Educational approaches</h3>
            <Link href="/approaches" className="text-sm text-mega-blue font-medium">
              See all approaches →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {approaches.map((a) => (
              <Link
                key={a.id}
                href={`/approaches/${a.slug}`}
                className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
              >
                <h4 className="font-semibold text-slate-800">{a.name}</h4>
                {a.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
