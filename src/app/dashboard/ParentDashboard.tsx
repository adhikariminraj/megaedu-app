import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import LinkChildPrompt from "@/components/LinkChildPrompt";
import AcademicProgressPanel, {
  AttendanceRow,
  ProgressRow,
  TestResultRow,
  EvaluationRow,
} from "@/components/AcademicProgressPanel";

type MeetingRow = {
  id: string;
  teacherName: string;
  subjectName: string | null;
  scheduledAt: string;
  location: string | null;
  onlineUrl: string | null;
  status: string;
  outcomeNotes: string | null;
};

type Parent = {
  id: string;
  children: {
    student: {
      gradeLevel: string | null;
      approved: boolean;
      user: { name: string };
      school: { name: string } | null;
    };
    progress: {
      attendance: AttendanceRow[];
      teachingProgress: ProgressRow[];
      testResults: TestResultRow[];
      evaluations: EvaluationRow[];
    };
    // Parent-only — Students have no PTM visibility in this phase, so
    // this field deliberately doesn't exist anywhere in StudentDashboard's
    // own props.
    meetings: MeetingRow[];
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

                {(c.progress.attendance.length > 0 ||
                  c.progress.teachingProgress.length > 0 ||
                  c.progress.testResults.length > 0 ||
                  c.progress.evaluations.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 [&>div:last-child]:mb-0">
                    <AcademicProgressPanel
                      attendance={c.progress.attendance}
                      teachingProgress={c.progress.teachingProgress}
                      testResults={c.progress.testResults}
                      evaluations={c.progress.evaluations}
                    />
                  </div>
                )}

                {c.meetings.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="font-semibold text-slate-800 mb-1">Parent-Teacher Meetings</h3>
                    <div className="space-y-2">
                      {c.meetings.map((m) => (
                        <div key={m.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {m.subjectName ?? "General"} — {m.teacherName}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                m.status === "COMPLETED"
                                  ? "bg-green-100 text-green-700"
                                  : m.status === "CANCELLED"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">
                            {new Date(m.scheduledAt).toLocaleString()}
                            {m.location ? ` — ${m.location}` : ""}
                            {m.onlineUrl ? ` — ${m.onlineUrl}` : ""}
                          </p>
                          {m.status === "COMPLETED" && m.outcomeNotes && (
                            <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.outcomeNotes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <LinkChildPrompt />
    </div>
  );
}
