import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * A single notice's own stable, shareable URL. The notice must belong
 * to THIS school (params.slug) — looked up via the school first, then
 * matched by id + schoolId together, never by id alone, so a notice id
 * can't be viewed under a different school's slug.
 */
export default async function SchoolNoticePage({
  params,
}: {
  params: { slug: string; noticeId: string };
}) {
  const school = await prisma.school.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true, verified: true, isActive: true },
  });
  if (!school || !school.verified || !school.isActive) notFound();

  const notice = await prisma.newsPost.findUnique({ where: { id: params.noticeId } });
  if (!notice || notice.schoolId !== school.id) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-slate-400 mb-1">
        <Link href={`/schools/${school.slug}/notices`} className="hover:underline">
          ← {school.name} · Public Notices
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{notice.title}</h1>
      <p className="text-xs text-slate-400 mb-6">
        {new Date(notice.publishedAt).toLocaleDateString()}
      </p>
      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
    </div>
  );
}
