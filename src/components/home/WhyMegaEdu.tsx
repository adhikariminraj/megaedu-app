const CHAIN = [
  { icon: "🏫", label: "Schools", color: "mega-navy" },
  { icon: "🧑‍🏫", label: "Educators", color: "mega-green" },
  { icon: "🎓", label: "Students", color: "mega-gold" },
  { icon: "👨‍👩‍👧", label: "Parents", color: "mega-red" },
  { icon: "📚", label: "Learning", color: "mega-blue" },
  { icon: "🌟", label: "Opportunities", color: "mega-purple" },
  { icon: "🏢", label: "Organizations", color: "mega-navy" },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  "mega-navy": "border-mega-navy text-mega-navy bg-blue-50",
  "mega-green": "border-mega-green text-mega-green bg-green-50",
  "mega-gold": "border-mega-gold text-mega-gold bg-amber-50",
  "mega-red": "border-mega-red text-mega-red bg-red-50",
  "mega-blue": "border-mega-blue text-mega-blue bg-blue-50",
  "mega-purple": "border-mega-purple text-mega-purple bg-purple-50",
};

function Node({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl ${COLOR_CLASSES[color]}`}
      >
        {icon}
      </div>
      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function WhyMegaEdu() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl font-semibold text-slate-800 mb-3">Why MEGA.EDU?</h2>
        <p className="text-slate-500">
          More than school management software — MEGA.EDU is the connective
          layer that links every part of a learner&apos;s journey into one
          verified network.
        </p>
      </div>

      {/* Desktop: horizontal chain */}
      <div className="hidden md:flex items-center justify-between">
        {CHAIN.map((c, i) => (
          <div key={c.label} className="flex items-center flex-1 last:flex-none">
            <Node {...c} />
            {i < CHAIN.length - 1 && (
              <div className="flex-1 h-px bg-slate-200 mx-2" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical chain */}
      <div className="md:hidden flex flex-col items-center gap-0">
        {CHAIN.map((c, i) => (
          <div key={c.label} className="flex flex-col items-center">
            <Node {...c} />
            {i < CHAIN.length - 1 && (
              <div className="w-px h-6 bg-slate-200" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
