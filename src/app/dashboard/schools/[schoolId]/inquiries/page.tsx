import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import InquiryResolveButton from "@/components/InquiryResolveButton";

export const dynamic = "force-dynamic";

/**
 * School Admin inbox for public General Inquiries — Public School
 * Gateway, Phase 1. URL-scoped, matching the Phase 4D institutional-
 * context pattern: the URL's schoolId is authoritative, re-verified
 * fresh on every request via requireSchoolAdmin() (School-Admin-only —
 * not verifySchoolAccess(), since a Teacher has no business here).
 *
 * Deliberately simple: no assignment, no internal notes, no threading,
 * no email replies (see the Phase 1 scope). A single status toggle
 * (NEW <-> RESOLVED) is the only action.
 */
export default async function SchoolInquiriesPage({ params }: { params: { schoolId: string } }) {
  const userId = await requireSchoolAdmin(params.schoolId);
  if (!userId) redirect("/dashboard");

  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { id: true, name: true },
  });
  if (!school) redirect("/dashboard");

  const inquiries = await prisma.inquiry.findMany({
    where: { schoolId: params.schoolId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{school.name}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Inquiries</h1>

      {inquiries.length === 0 ? (
        <p className="text-slate-400 text-sm">
          No inquiries yet. Public visitors can reach this school at{" "}
          <Link href={`/schools`} className="text-mega-blue hover:underline">
            its public profile
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <div key={inq.id} className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800">{inq.name}</p>
                  <p className="text-sm text-slate-500">{inq.email}</p>
                  {inq.phone && <p className="text-sm text-slate-500">{inq.phone}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold bg-blue-50 text-mega-navy rounded-full px-3 py-1">
                    {inq.category}
                  </span>
                  <span
                    className={`text-xs font-semibold rounded-full px-3 py-1 ${
                      inq.status === "NEW"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {inq.status === "NEW" ? "New" : "Resolved"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{inq.message}</p>
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-slate-400">
                  {new Date(inq.createdAt).toLocaleString()}
                </p>
                <InquiryResolveButton
                  schoolId={school.id}
                  inquiryId={inq.id}
                  status={inq.status as "NEW" | "RESOLVED"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
