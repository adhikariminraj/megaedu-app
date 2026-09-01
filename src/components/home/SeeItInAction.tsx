import Image from "next/image";

const EXAMPLES = [
  {
    key: "class-overview",
    src: "/screenshots/class-overview.png",
    title: "Class Overview",
    description: "Teachers, sections, and a live grade-wide ranking — computed from real results, not guessed.",
  },
  {
    key: "report-card",
    src: "/screenshots/report-card.png",
    title: "Student Results",
    description: "Published subject results, grades and GPA — the same live report card a student or parent sees.",
  },
  {
    key: "certificate",
    src: "/screenshots/certificate.png",
    title: "Certificate",
    description: "A verifiable credential, checkable by anyone with the link — no login required.",
  },
] as const;

export default function SeeItInAction({ certificateVerifyUrl }: { certificateVerifyUrl: string | null }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl font-semibold text-slate-800 mb-3">See It in Action</h2>
        <p className="text-slate-500">
          Real screens from the MEGA.EDU demo environment — genuine implemented
          functionality, not mockups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {EXAMPLES.map((ex) => {
          const href = ex.key === "certificate" ? certificateVerifyUrl : null;
          const Figure = (
            <>
              <div className="relative aspect-[1280/800] bg-slate-100 rounded-t-xl overflow-hidden border border-b-0 border-slate-200">
                <Image
                  src={ex.src}
                  alt={`${ex.title} — MEGA.EDU screenshot`}
                  fill
                  className="object-cover object-top"
                  sizes="(min-width: 768px) 33vw, 100vw"
                />
              </div>
              <div className="border border-t-0 border-slate-200 rounded-b-xl p-5">
                <h3 className="font-semibold text-slate-800">{ex.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{ex.description}</p>
                {href && (
                  <span className="inline-block mt-3 text-sm font-medium text-mega-blue">
                    Verify this certificate →
                  </span>
                )}
              </div>
            </>
          );

          return href ? (
            <a key={ex.key} href={href} className="block hover:shadow-md transition rounded-xl">
              {Figure}
            </a>
          ) : (
            <div key={ex.key}>{Figure}</div>
          );
        })}
      </div>
    </section>
  );
}
