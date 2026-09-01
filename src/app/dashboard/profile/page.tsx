import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfilePhotoManager from "@/components/ProfilePhotoManager";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  ORGANIZATION_ADMIN: "Organization Admin",
  ACCOUNTANT: "Accountant",
};

/**
 * A focused first version of a self-service MEGA ID profile page —
 * photo, name, email, identity, and role(s) only. Deliberately not a
 * full account-management surface (no password change, no editable
 * name/email here) — this is a foundation for future MEGA ID profile
 * work, not that work itself.
 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      teacherProfile: { include: { school: true } },
      studentProfile: { include: { school: true } },
      administeredSchools: { include: { school: true }, take: 1 },
    },
  });
  if (!user) redirect("/login");

  const schoolName =
    user.teacherProfile?.school?.name ||
    user.studentProfile?.school?.name ||
    user.administeredSchools[0]?.school?.name ||
    null;

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">My Profile</h1>
      <p className="text-slate-500 text-sm mb-8">Your MEGA ID identity.</p>

      <div className="border border-slate-200 rounded-xl p-5 mb-6">
        <ProfilePhotoManager name={user.name} avatarUrl={user.avatarUrl} />
      </div>

      <div className="border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Name</p>
          <p className="text-slate-800 font-medium">{user.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Email</p>
          <p className="text-slate-800 font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">MEGA ID</p>
          <p className="text-slate-500 font-mono text-xs">{user.id}</p>
        </div>
        {schoolName && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">School</p>
            <p className="text-slate-800 font-medium">{schoolName}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Role{user.roles.length > 1 ? "s" : ""}</p>
          <div className="flex gap-2 flex-wrap mt-1">
            {user.roles.map((r) => (
              <span
                key={r.id}
                className="text-xs font-semibold bg-blue-50 text-mega-navy rounded-full px-3 py-1"
              >
                {ROLE_LABELS[r.role] || r.role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
