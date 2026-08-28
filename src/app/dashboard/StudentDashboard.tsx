import Link from "next/link";
import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import JoinSchoolPrompt from "@/components/JoinSchoolPrompt";
import InterestManager from "@/components/InterestManager";

type Student = {
  id: string;
  gradeLevel: string | null;
  approved: boolean;
  user: { name: string; email: string; interests: { id: string; name: string }[] };
  school: { name: string; slug: string } | null;
  skills: { id: string; name: string; addedBy: { name: string } }[];
  courseEnrollments: {
    id: string;
    progress: number;
    course: { title: string; slug: string };
    certificate: { id: string; verificationCode: string } | null;
  }[];
};

export default function StudentDashboard({ student, userName }: { student: Student; userName: string }) {
  if (!student.school) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <DashboardHero
          name={userName}
          subtitle="One more step — connect your MEGA ID to your school."
          cards={[]}
        />
        <div className="mb-6">
          <InterestManager interests={student.user.interests} />
        </div>
        <JoinSchoolPrompt role="STUDENT" endpoint="/api/student/join-school" />
      </div>
    );
  }

  const inProgress = student.courseEnrollments.find((e) => !e.certificate);

  const heroCards: HeroCard[] = [];
  if (!student.approved) {
    heroCards.push({
      icon: "⏳",
      title: "Pending school approval",
      description: `Waiting on ${student.school.name} to approve your account.`,
      href: "/schools",
      cta: "View your school",
      accent: "gold",
    });
  }
  if (inProgress) {
    heroCards.push({
      icon: "📘",
      title: `Continue: ${inProgress.course.title}`,
      description: "Pick up where you left off.",
      href: `/courses/${inProgress.course.slug}/learn`,
      cta: "Continue learning",
      accent: "navy",
    });
  }
  heroCards.push({
    icon: "🌟",
    title: "New opportunities",
    description: "Scholarships, competitions and events just for students.",
    href: "/opportunities",
    cta: "Browse opportunities",
    accent: "purple",
  });
  heroCards.push({
    icon: "🎓",
    title: "Browse MEGA Academy",
    description: "Find a new course to enroll in.",
    href: "/courses",
    cta: "Explore courses",
    accent: "green",
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={`Student${student.gradeLevel ? ` · ${student.gradeLevel}` : ""} at ${student.school.name}`}
        cards={heroCards.slice(0, 3)}
      />

      <div className="border border-slate-200 rounded-xl p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">School</p>
            <p className="font-medium text-slate-800">{student.school.name}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              student.approved
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {student.approved ? "Approved" : "Pending School Approval"}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <InterestManager interests={student.user.interests} />
      </div>

      <div className="border border-slate-200 rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-slate-800 mb-1">Skills & Competencies</h3>
        <p className="text-xs text-slate-400 mb-4">
          Added by your teachers — you can view these, but only a teacher
          or your School Admin can add or change them.
        </p>
        <div className="flex flex-wrap gap-2">
          {student.skills.length === 0 ? (
            <p className="text-sm text-slate-400">No skills recorded yet.</p>
          ) : (
            student.skills.map((sk) => (
              <span
                key={sk.id}
                title={`Added by ${sk.addedBy.name}`}
                className="text-xs bg-green-50 text-mega-green font-medium rounded-full px-3 py-1"
              >
                {sk.name} · {sk.addedBy.name}
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Your Courses</h2>
          <Link href="/courses" className="text-sm text-mega-blue font-medium">
            Browse MEGA Academy →
          </Link>
        </div>
        {student.courseEnrollments.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Not enrolled in anything yet — browse MEGA Academy to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {student.courseEnrollments.map((e) => (
              <div
                key={e.id}
                className="border border-slate-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{e.course.title}</p>
                  {e.certificate && (
                    <a
                      href={`/dashboard/certificates/${e.certificate.id}/preview`}
                      className="text-xs text-mega-blue"
                    >
                      View certificate →
                    </a>
                  )}
                </div>
                <Link
                  href={`/courses/${e.course.slug}/learn`}
                  className="text-sm font-semibold text-mega-navy"
                >
                  {e.certificate ? "Review" : "Continue"} →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
