import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TYPE_ICONS: Record<string, string> = {
  SCHOOL_ANNOUNCEMENT: "📢",
  STAFF_APPROVED: "✅",
  STUDENT_APPROVED: "✅",
  CERTIFICATE_ISSUED: "🎓",
  SCHOOL_VERIFIED: "🏫",
  ORGANIZATION_VERIFIED: "🏢",
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Reading this page marks everything as seen — simplest possible
  // model for an MVP, matching how most people expect a notification
  // list to behave.
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Notifications</h1>

      {notifications.length === 0 ? (
        <p className="text-slate-400">
          Nothing yet — you&apos;ll see updates here when your school posts
          news, when you&apos;re approved, or when you earn a certificate.
        </p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`border rounded-xl p-4 flex gap-3 ${
                n.read ? "border-slate-200" : "border-mega-blue bg-blue-50/40"
              }`}
            >
              <div className="text-xl">{TYPE_ICONS[n.type] || "🔔"}</div>
              <div className="flex-1">
                <p className="font-medium text-slate-800 text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
