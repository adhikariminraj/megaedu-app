import Link from "next/link";
import { Josefin_Sans, Libre_Baskerville } from "next/font/google";

const josefinSans = Josefin_Sans({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: "700",
  style: "italic",
  display: "swap",
});

const ROLE_ENTRIES = [
  { role: "SCHOOL_ADMIN", label: "School", accent: "border-mega-navy text-mega-navy" },
  { role: "TEACHER", label: "Teacher", accent: "border-mega-green text-mega-green" },
  { role: "STUDENT", label: "Student", accent: "border-mega-gold text-mega-gold" },
  { role: "PARENT", label: "Parent", accent: "border-mega-red text-mega-red" },
  { role: "ORGANIZATION_ADMIN", label: "Organization", accent: "border-mega-purple text-mega-purple" },
] as const;

export default function HomeHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section
      className="relative text-white bg-cover bg-center"
      style={{ backgroundImage: "url('/hero-himalaya.jpg')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/50 to-slate-900/70" />
      <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
        <h1
          className={`${josefinSans.className} font-normal text-4xl md:text-5xl tracking-wide mb-4`}
          style={{ textShadow: "0 2px 14px rgba(0,0,0,0.35), 0 0 2px rgba(255,255,255,0.3)" }}
        >
          One network for Every School, Teacher, Student,
          Parent and Education Approach.
        </h1>
        <p className={`${libreBaskerville.className} inline-block text-lg font-bold italic text-slate-800 bg-orange-50/90 rounded-xl px-5 py-3 max-w-2xl mx-auto mb-6`}>
          MEGA.EDU connects schools, teachers, students, parents and education
          organizations — giving every school a digital identity and access to
          training, resources and opportunities.
        </p>
        <p
          className="inline-block text-sm font-medium text-slate-800 bg-green-50/90 rounded-lg px-5 py-2.5 mb-8"
          style={{ textShadow: "0 0 3px rgba(255,255,255,0.6), 0 0 1px rgba(255,255,255,0.5)" }}
        >
          A growing network of verified schools, educators and learners — connected under one identity.
        </p>

        {isLoggedIn ? (
          <span
            title="You already have a MEGA ID"
            aria-disabled="true"
            className="inline-block bg-mega-navy/40 text-white/70 font-semibold px-8 py-3 rounded-full shadow-lg cursor-not-allowed select-none"
          >
            You already have a MEGA ID
          </span>
        ) : (
          <>
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-white/40" />
              <p
                className={`${libreBaskerville.className} text-xl sm:text-2xl italic tracking-wide bg-gradient-to-r from-mega-gold via-amber-200 to-mega-green bg-clip-text text-transparent`}
              >
                I am a&hellip;
              </p>
              <span className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-white/40" />
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap max-w-2xl mx-auto">
              {ROLE_ENTRIES.map((r) => (
                <Link
                  key={r.role}
                  href={`/register?role=${r.role}`}
                  className={`bg-white/95 border-2 ${r.accent} font-semibold px-5 py-2.5 rounded-full shadow-lg hover:bg-white transition text-sm`}
                >
                  {r.label}
                </Link>
              ))}
            </div>
            <p className="text-sm text-slate-300 mt-6">
              Already have a MEGA ID?{" "}
              <Link href="/login" className="font-semibold text-white underline underline-offset-2">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
