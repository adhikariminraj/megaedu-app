import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the userId if the current session belongs to a School Admin
 * for the given schoolId, otherwise null. Use this at the top of every
 * write route under /api/schools/[id]/* to enforce that a school admin
 * can only ever edit their own school.
 */
export async function requireSchoolAdmin(schoolId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const link = await prisma.schoolAdmin.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session belongs to an Organization
 * Admin for the given organizationId, otherwise null.
 */
export async function requireOrgAdmin(organizationId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const link = await prisma.organizationAdmin.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session's Organization Admin owns
 * the given course (via the course's organizationId), otherwise null.
 */
export async function requireCourseOwner(courseId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course?.organizationId) return null;

  const link = await prisma.organizationAdmin.findUnique({
    where: { userId_organizationId: { userId, organizationId: course.organizationId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session holds the PLATFORM_ADMIN
 * role, otherwise null. Use this to gate everything under /admin and
 * /api/admin/*.
 */
export async function requirePlatformAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return null;
  if (!user.roles?.includes("PLATFORM_ADMIN")) return null;
  return user.id as string;
}
