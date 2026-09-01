import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/schools", label: "Schools" },
      { href: "/courses", label: "Courses" },
      { href: "/opportunities", label: "Opportunities" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/calendar", label: "Calendar" },
      { href: "/resources", label: "Resources" },
      { href: "/approaches", label: "Approaches" },
      { href: "/organizations", label: "Organizations" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Get Started" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <span className="text-lg font-semibold">
            <span className="text-mega-navy">mega</span>
            <span className="text-mega-red">.</span>
            <span className="text-mega-gold">e</span>
            <span className="text-mega-blue">d</span>
            <span className="text-mega-green">u</span>
          </span>
          <p className="text-sm text-slate-500 mt-3 max-w-[220px]">
            One network for every school, teacher, student, parent and education approach.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-600 hover:text-mega-navy">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-slate-500 flex flex-col md:flex-row justify-between gap-2">
          <p>© {new Date().getFullYear()} MEGA.EDU — Education for Everyone</p>
          <p>Built for Nepal&apos;s schools, teachers, students and parents.</p>
        </div>
      </div>
    </footer>
  );
}
