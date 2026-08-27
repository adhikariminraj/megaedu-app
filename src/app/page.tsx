import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "🪪", title: "One MEGA ID", description: "A single login for every role — Student, Teacher, Parent, School, or Organization." },
  { icon: "🏫", title: "School Directory", description: "Verified school profiles, searchable across the whole network." },
  { icon: "🎓", title: "MEGA Academy", description: "Courses, certificates, and professional development, from verified organizations." },
  { icon: "🌟", title: "Opportunities", description: "Scholarships, competitions, events, and jobs posted by real schools and organizations." },
  { icon: "🧭", title: "Educational Approaches", description: "CBE, STEM, Montessori and more — each with its own community of schools." },
  { icon: "✅", title: "Verified, Not Anonymous", description: "Every school and organization is verified before they can post anything." },
];

export default async function HomePage() {
  const schoolCount = await prisma.school.count({ where: { verified: true } });
  const recentSchools = await prisma.school.findMany({
    where: { verified: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const approaches = await prisma.educationalApproach.findMany({ take: 4 });
  const opportunities = await prisma.opportunity.findMany({
    include: { school: true, organization: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const news = await prisma.newsPost.findMany({
    include: { school: true },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <div>
      <section
        className="relative text-white bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-himalaya.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/50 to-slate-900/70" />
        <div className="relative max-w-6xl mx-auto px-6 py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-md">
            One network for every school, teacher, and student.
          </h1>
          <p className="text-lg text-slate-100 max-w-2xl mx-auto mb-8 drop-shadow">
            MEGA.EDU connects schools, teachers, students, parents and education
            organizations — giving every school a digital identity and access to
            training, resources and opportunities.
          </p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <Link
              href="/register"
              className="bg-mega-navy text-white font-semibold px-12 py-4 rounded-full hover:bg-mega-blue transition text-lg shadow-lg"
            >
              Register
            </Link>
            <span className="text-xl font-semibold drop-shadow-md bg-white/95 rounded-full px-5 py-3 shadow-lg inline-flex items-baseline">
              <span className="text-mega-navy">mega</span>
              <span className="text-mega-red">.</span>
              <span className="text-mega-gold">e</span>
              <span className="text-mega-blue">d</span>
              <span className="text-mega-green">u</span>
            </span>
            <a
              href="#explore"
              className="bg-white/95 text-mega-navy font-semibold px-12 py-4 rounded-full hover:bg-white transition text-lg shadow-lg"
            >
              Explore mega.edu
            </a>
          </div>
        </div>
      </section>

      <section id="explore" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-16">
          <div>
            <div className="text-4xl font-bold text-mega-navy">{schoolCount}</div>
            <div className="text-slate-500 mt-1">Verified schools</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-mega-navy">5</div>
            <div className="text-slate-500 mt-1">Educational approaches</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-mega-navy">1</div>
            <div className="text-slate-500 mt-1">MEGA ID for everything</div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-slate-800">What MEGA.EDU offers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="border border-slate-200 rounded-xl p-5">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-semibold text-slate-800">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {approaches.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Programs</h2>
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
                  <h3 className="font-semibold text-slate-800">{a.name}</h3>
                  {a.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {opportunities.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">Campaigns</h2>
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
                  <h3 className="font-semibold text-slate-800 mt-2">{o.title}</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    {o.school?.name || o.organization?.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {news.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 text-slate-800">News</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {news.map((n) => (
                <div key={n.id} className="border border-slate-200 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-800">{n.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-3">{n.school.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentSchools.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-slate-800">Recently joined</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentSchools.map((s) => (
                <Link
                  key={s.id}
                  href={`/schools/${s.slug}`}
                  className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-slate-800">{s.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{s.location || "Nepal"}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
