const STEPS = [
  {
    number: "1",
    title: "Get verified",
    description: "Register your school or organization — a Platform Admin verifies it before it goes live.",
  },
  {
    number: "2",
    title: "Invite your people",
    description: "Teachers and students get accounts a school admin approves; parents link to their children.",
  },
  {
    number: "3",
    title: "Run the real work",
    description: "Attendance, assessments, report cards, evaluations — the daily work of a school, in one place.",
  },
  {
    number: "4",
    title: "Stay connected",
    description: "Student, parent and teacher all see the same real record — always up to date, never a separate copy.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-mega-paper border-y border-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-slate-800 text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.number} className="text-center">
              <div className="w-10 h-10 rounded-full bg-mega-navy text-white font-bold flex items-center justify-center mx-auto mb-4">
                {s.number}
              </div>
              <h3 className="font-semibold text-slate-800 mb-1.5">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
