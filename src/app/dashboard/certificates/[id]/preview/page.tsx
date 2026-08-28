import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCertificateViewModel } from "@/lib/certificateView";
import CertificateDocument from "@/components/certificate/CertificateDocument";
import CertificateScaler from "@/components/certificate/CertificateScaler";

export const dynamic = "force-dynamic";

export default async function CertificatePreviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const certificate = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: {
      issuerSchool: { select: { logoUrl: true } },
      associatedSchool: { select: { logoUrl: true } },
    },
  });
  if (!certificate) notFound();

  const roles = (session!.user as any).roles as string[] | undefined;
  const isRecipient = certificate.recipientUserId === userId;
  const isPlatformAdmin = roles?.includes("PLATFORM_ADMIN");
  if (!isRecipient && !isPlatformAdmin) redirect("/dashboard");

  const vm = buildCertificateViewModel(certificate);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 print:p-0 print:max-w-none">
      <div className="mb-6 print:hidden">
        <h1 className="text-xl font-bold text-slate-800">Certificate Preview</h1>
        <p className="text-sm text-slate-500">
          Design preview at true A4 landscape size — PDF export isn&apos;t wired up yet.
        </p>
      </div>
      <CertificateScaler>
        <CertificateDocument certificate={vm} />
      </CertificateScaler>
    </div>
  );
}
