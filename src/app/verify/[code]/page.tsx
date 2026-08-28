import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ISSUER_LABELS: Record<string, string> = {
  MEGA_EDU: "MEGA.EDU",
  ORGANIZATION: "an Organization",
  SCHOOL: "a School",
  JOINT: "a joint issuance",
};

export default async function VerifyCertificatePage({ params }: { params: { code: string } }) {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: params.code },
  });

  return (
    <div className="max-w-lg mx-auto px-6 py-20 text-center">
      {certificate ? (
        <>
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-6 text-2xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Certificate Verified</h1>
          <p className="text-slate-500 mb-8">
            This is a genuine MEGA.EDU certificate, issued by {ISSUER_LABELS[certificate.issuerType] || certificate.issuerType}.
          </p>
          <div className="border border-slate-200 rounded-xl p-6 text-left space-y-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Course / Achievement</p>
              <p className="font-medium text-slate-800">{certificate.title}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Awarded to</p>
              <p className="font-medium text-slate-800">{certificate.recipientNameSnapshot}</p>
              <p className="text-xs text-slate-400 font-mono">{certificate.recipientMegaIdSnapshot}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Issued by</p>
              <p className="font-medium text-slate-800">{certificate.issuerNameSnapshot}</p>
            </div>
            {certificate.associatedSchoolNameSnapshot && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">School</p>
                <p className="font-medium text-slate-800">{certificate.associatedSchoolNameSnapshot}</p>
              </div>
            )}
            {certificate.instructorNameSnapshot && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Instructor</p>
                <p className="font-medium text-slate-800">{certificate.instructorNameSnapshot}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Issued</p>
              <p className="font-medium text-slate-800">
                {new Date(certificate.issuedAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Verification Code</p>
              <p className="font-mono text-xs text-slate-500">{certificate.verificationCode}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-red-100 text-mega-red flex items-center justify-center mx-auto mb-6 text-2xl">
            ✕
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Certificate Not Found</h1>
          <p className="text-slate-500">
            No certificate matches this verification code. Double-check the link.
          </p>
        </>
      )}
    </div>
  );
}
