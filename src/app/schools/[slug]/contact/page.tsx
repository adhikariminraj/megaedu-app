import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import InquiryForm from "@/components/InquiryForm";

export const dynamic = "force-dynamic";

/**
 * General Inquiry only, in Phase 1 — the category picker (Parent /
 * Student / Admission / Teacher-Employment / Institutional / Other) is
 * explicitly deferred. Anonymous by design: no session is read or
 * required anywhere on this page, and the school is resolved from the
 * URL slug alone, never from any authenticated context.
 */
export default async function SchoolContactPage({ params }: { params: { slug: string } }) {
  const school = await prisma.school.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true, verified: true, isActive: true },
  });

  if (!school || !school.verified || !school.isActive) notFound();

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <p className="text-sm text-slate-400 mb-1">
        <Link href={`/schools/${school.slug}`} className="hover:underline">
          ← {school.name}
        </Link>
      </p>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Contact {school.name}</h1>
      <p className="text-slate-500 mb-8">
        Send a general inquiry — no account needed. The school will see your message in
        their inbox.
      </p>

      <InquiryForm schoolId={school.id} schoolName={school.name} />
    </div>
  );
}
