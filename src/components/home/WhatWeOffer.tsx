const FEATURES = [
  { icon: "🪪", title: "One MEGA ID", description: "A single login for every role — Student, Teacher, Parent, School, or Organization." },
  { icon: "🏫", title: "School Directory", description: "Verified school profiles, searchable across the whole network." },
  { icon: "🎓", title: "MEGA Academy", description: "Courses, certificates, and professional development, from verified organizations." },
  { icon: "🌟", title: "Opportunities", description: "Scholarships, competitions, events, and jobs posted by real schools and organizations." },
  { icon: "🧭", title: "Educational Approaches", description: "CBE, STEM, Montessori and more — each with its own community of schools." },
  { icon: "✅", title: "Verified, Not Anonymous", description: "Every school and organization is verified before they can post anything." },
];

export default function WhatWeOffer() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold mb-6 text-slate-800 text-center">What MEGA.EDU offers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="border border-slate-200 rounded-xl p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-slate-800">{f.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
