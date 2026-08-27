import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import LinkChildPrompt from "@/components/LinkChildPrompt";

type Parent = {
  id: string;
  children: {
    student: {
      gradeLevel: string | null;
      approved: boolean;
      user: { name: string };
      school: { name: string } | null;
    };
  }[];
};

export default function ParentDashboard({ parent, userName }: { parent: Parent; userName: string }) {
  const childNames = parent.children.map((c) => c.student.user.name.split(" ")[0]).join(", ");

  const heroCards: HeroCard[] = [
    {
      icon: "🌟",
      title: "New opportunities",
      description: childNames
        ? `Scholarships and competitions ${childNames} could apply for.`
        : "Scholarships, competitions and events across the network.",
      href: "/opportunities",
      cta: "Browse opportunities",
      accent: "purple",
    },
    {
      icon: "🏫",
      title: "School directory",
      description: "See other schools across the MEGA.EDU network.",
      href: "/schools",
      cta: "Browse schools",
      accent: "navy",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={
          parent.children.length > 0
            ? `Following ${childNames}'s progress.`
            : "Link your child to get started."
        }
        cards={heroCards}
      />

      {parent.children.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Children</h2>
          <div className="space-y-4 mb-8">
            {parent.children.map((c, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-5">
                <p className="font-medium text-slate-800">{c.student.user.name}</p>
                <p className="text-sm text-slate-500">
                  {c.student.school?.name || "No school linked yet"}
                  {c.student.gradeLevel ? ` · ${c.student.gradeLevel}` : ""}
                </p>
                <span
                  className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
                    c.student.approved
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.student.approved ? "Approved" : "Pending School Approval"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <LinkChildPrompt />
    </div>
  );
}
