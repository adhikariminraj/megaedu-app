import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import VerifyButton from "./VerifyButton";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const adminId = await requirePlatformAdmin();
  if (!adminId) redirect("/login");

  const pending = await prisma.school.findMany({
    where: { verified: false },
    orderBy: { createdAt: "asc" },
    include: { admins: { include: { user: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Verification Queue</h1>
      <p className="text-slate-500 mb-2">
        Schools waiting for verification before they appear publicly in the
        directory.
      </p>
      <a href="/admin/organizations" className="text-sm text-mega-blue font-medium">
        Organization Verification Queue →
      </a>
      <div className="mt-8">

      {pending.length === 0 ? (
        <p className="text-slate-400">Nothing pending — all caught up.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((school) => (
            <div
              key={school.id}
              className="border border-slate-200 rounded-xl p-5 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-slate-800">{school.name}</p>
                <p className="text-sm text-slate-500">
                  {school.location || "No location set"} · Registered by{" "}
                  {school.admins[0]?.user.name} ({school.admins[0]?.user.email})
                </p>
              </div>
              <VerifyButton schoolId={school.id} />
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
