import Link from "next/link";
import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import JoinSchoolPrompt from "@/components/JoinSchoolPrompt";

type Teacher = {
  id: string;
  bio: string | null;
  subjects: string | null;
  position: string;
  approved: boolean;
  user: { name: string; email: string };
  school: { name: string; slug: string } | null;
  courseEnrollments: {
    id: string;
    progress: number;
    course: { title: string; slug: string };
    certificate: { verificationCode: string } | null;
  }[];
};

export default function TeacherDashboard({ teacher, userName }: { teacher: Teacher; userName: string }) {
  // Registered via the unified /register flow with no school chosen yet.
  if (!teacher.school) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <DashboardHero
          name={userName}
          subtitle="One more step — connect your MEGA ID to your school."
          cards={[]}
        />
        <JoinSchoolPrompt role="TEACHER" endpoint="/api/teacher/join-school" />
      </div>
    );
  }

  const inProgress = teacher.courseEnrollments.find((e) => !e.certificate);

  const heroCards: HeroCard[] = [];
  if (!teacher.approved) {
    heroCards.push({
      icon: "⏳",
      title: "Pending school approval",
      description: `Waiting on ${teacher.school.name} to approve your account.`,
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
    description: "Scholarships, competitions and events for your students.",
    href: "/opportunities",
    cta: "Browse opportunities",
    accent: "purple",
  });
  heroCards.push({
    icon: "🎓",
    title: "Browse MEGA Academy",
    description: "Find your next professional development course.",
    href: "/courses",
    cta: "Explore courses",
    accent: "green",
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={`${teacher.position} at ${teacher.school.name}`}
        cards={heroCards.slice(0, 3)}
      />

      <div className="border border-slate-200 rounded-xl p-6 space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">School</p>
            <p className="font-medium text-slate-800">{teacher.school.name}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              teacher.approved
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {teacher.approved ? "Approved" : "Pending School Approval"}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Your Courses</h2>
          <Link href="/courses" className="text-sm text-mega-blue font-medium">
            Browse MEGA Academy →
          </Link>
        </div>
        {teacher.courseEnrollments.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Not enrolled in anything yet — browse MEGA Academy to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {teacher.courseEnrollments.map((e) => (
              <div
                key={e.id}
                className="border border-slate-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{e.course.title}</p>
                  {e.certificate && (
                    <a
                      href={`/verify/${e.certificate.verificationCode}`}
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
