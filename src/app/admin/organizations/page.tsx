import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import VerifyOrgButton from "./VerifyOrgButton";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const adminId = await requirePlatformAdmin();
  if (!adminId) redirect("/login");

  const pending = await prisma.organization.findMany({
    where: { verified: false },
    orderBy: { createdAt: "asc" },
    include: { admins: { include: { user: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Organization Verification</h1>
      </div>
      <p className="text-slate-500 mb-2">
        Organizations waiting for verification before they can publish courses.
      </p>
      <Link href="/admin/schools" className="text-sm text-mega-blue font-medium">
        ← Back to School Verification Queue
      </Link>

      <div className="mt-8">
        {pending.length === 0 ? (
          <p className="text-slate-400">Nothing pending — all caught up.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((org) => (
              <div
                key={org.id}
                className="border border-slate-200 rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">{org.name}</p>
                  <p className="text-sm text-slate-500">
                    Registered by {org.admins[0]?.user.name} ({org.admins[0]?.user.email})
                  </p>
                </div>
                <VerifyOrgButton orgId={org.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
