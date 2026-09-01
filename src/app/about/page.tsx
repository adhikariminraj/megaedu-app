import Link from "next/link";

export const metadata = {
  title: "About — MEGA.EDU",
  description:
    "MEGA.EDU is a national education network connecting schools, teachers, students, parents and education organizations under one identity: MEGA ID.",
};

const MODULES = [
  {
    title: "MEGA ID",
    description:
      "One account, one or more roles. A student, teacher, parent, school administrator, or organization admin all sign in the same way — with the same identity that follows them wherever they go in the network.",
  },
  {
    title: "Schools & Organizations",
    description:
      "Verified directory listings for schools and education organizations, each with its own admin-managed profile and a staff/member approval workflow.",
  },
  {
    title: "MEGA Academy",
    description:
      "Online courses published by verified organizations, with modules, lessons, enrollment and completion tracking.",
  },
  {
    title: "Certificates",
    description:
      "Verifiable credentials issued automatically on course completion, with a public verification page anyone can check — no login required.",
  },
  {
    title: "Academic Sessions & Grades",
    description:
      "A structured school-year, grade and promotion system, so a student's placement and history stay accurate and auditable session after session.",
  },
  {
    title: "Attendance, Assessments & Report Cards",
    description:
      "Daily attendance, configurable marking schemes, published subject results, and a live report card that draws from the same real data teachers enter.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <div className="bg-mega-navy text-white">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">About MEGA.EDU</h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            A national education network connecting schools, teachers, students,
            parents and education organizations under one identity system.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-14">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">What MEGA.EDU is</h2>
          <p className="text-slate-600 leading-relaxed">
            In plain terms: a school gets a public profile and a digital identity.
            Teachers and students at that school get accounts a school
            administrator approves. Organizations can publish online courses and
            post opportunities — scholarships, competitions, jobs. Parents can
            follow their children&apos;s progress. Everyone, regardless of role,
            signs in with the same single account: a MEGA ID.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Why it exists</h2>
          <p className="text-slate-600 leading-relaxed">
            MEGA.EDU exists to give every school, teacher and student in the
            network a verifiable digital presence. A school&apos;s identity
            isn&apos;t tied to a single administrator&apos;s login. A
            student&apos;s learning record and certificates follow{" "}
            <em>them</em> rather than staying locked inside one school&apos;s
            paperwork. Achievements — course completions, skills, certificates —
            are independently verifiable by anyone with the right link: an
            employer, another school, a scholarship committee.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-3">What&apos;s built today</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
            {MODULES.map((m) => (
              <div key={m.title} className="border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-800">{m.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{m.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center border-t border-slate-100 pt-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Join the network</h2>
          <p className="text-slate-500 mb-6">
            Whether you&apos;re a school, a teacher, a student, a parent, or an
            organization — it starts with one MEGA ID.
          </p>
          <Link
            href="/register"
            className="inline-block bg-mega-navy text-white font-semibold px-8 py-3 rounded-full hover:bg-mega-blue transition"
          >
            Get Started
          </Link>
        </section>
      </div>
    </div>
  );
}
