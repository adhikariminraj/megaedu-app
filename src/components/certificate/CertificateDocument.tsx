import { Playfair_Display } from "next/font/google";
import type { CertificateViewModel } from "@/lib/certificateView";

// Scoped to this document only — the rest of the app keeps its system
// sans-serif stack. Self-hosted by Next.js at build time, no extra
// runtime dependency.
const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cert-display",
});

// A4 landscape at 96 CSS px/inch — matches the @page rule below so an
// eventual print/PDF pass renders this exact layout at true size.
const A4_WIDTH_PX = 1123;
const A4_HEIGHT_PX = 794;

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MegaWordmark({ size = "text-3xl" }: { size?: string }) {
  return (
    <span className={`${size} font-bold tracking-tight`}>
      <span className="text-mega-navy">mega</span>
      <span className="text-mega-red">.</span>
      <span className="text-mega-gold">e</span>
      <span className="text-mega-blue">d</span>
      <span className="text-mega-green">u</span>
    </span>
  );
}

function SignatureLine({ name, title }: { name: string; title: string }) {
  return (
    <div className="flex flex-col items-center w-48">
      <div className="w-full border-t border-slate-400 pt-2">
        <p className="text-sm font-semibold text-slate-700 truncate" title={name}>
          {name}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">{title}</p>
      </div>
    </div>
  );
}

export default function CertificateDocument({
  certificate,
}: {
  certificate: CertificateViewModel;
}) {
  const vm = certificate;
  const eyebrow = vm.isGradeCertificate ? "Certificate of Achievement" : "Certificate of Completion";
  const showOrgSignature = vm.issuerType !== "MEGA_EDU";
  // The associated school is only worth its own detail line when it isn't
  // already the entity shown as the partner in the header (avoids saying
  // the same school twice on a school-issued certificate).
  const showAffiliatedSchool =
    !!vm.associatedSchoolName && vm.associatedSchoolName !== vm.partner?.name;

  return (
    <>
      <style>{`
        @media print {
          @page { size: 297mm 210mm; margin: 0; }
        }
      `}</style>
      <div
        className={`${displayFont.variable} relative bg-white mx-auto shadow-2xl print:shadow-none`}
        style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
      >
        {/* Frame */}
        <div className="absolute inset-[8mm] border-[1.5px] border-mega-navy/70 pointer-events-none" />
        <div className="absolute inset-[10.5mm] border border-mega-gold/50 pointer-events-none" />

        {/* Content */}
        <div className="absolute inset-[8mm] flex flex-col px-[16mm] py-[13mm]">
          {/* Header: logos */}
          <div className={`flex items-start ${vm.partner ? "justify-between" : "justify-center"}`}>
            <div className={`flex flex-col ${vm.partner ? "items-start" : "items-center"}`}>
              <MegaWordmark />
              <span className="text-[9px] uppercase tracking-[0.25em] text-slate-400 mt-1">
                Education for Everyone
              </span>
            </div>

            {vm.partner && (
              <div className="flex flex-col items-end text-right max-w-[45%]">
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                  In partnership with
                </span>
                {vm.partner.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vm.partner.logoUrl}
                    alt={vm.partner.name}
                    className="h-10 max-w-[220px] object-contain"
                  />
                ) : (
                  <span className="text-lg font-semibold text-slate-700 break-words">
                    {vm.partner.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-[8mm]">
            <p className="text-xs uppercase tracking-[0.35em] text-mega-gold font-semibold mb-2">
              {eyebrow}
            </p>

            <p className="text-sm text-slate-500 mb-4">This certificate is proudly presented to</p>

            <h1
              className="text-5xl font-bold text-slate-800 leading-tight break-words max-w-[85%] mb-2"
              style={{ fontFamily: "var(--font-cert-display), serif" }}
            >
              {vm.recipientName}
            </h1>
            <p className="text-xs font-mono text-slate-400 mb-8">MEGA ID: {vm.recipientMegaId}</p>

            <p className="text-sm text-slate-500 mb-2">for successfully completing</p>
            <h2
              className="text-2xl font-semibold text-mega-navy leading-snug break-words max-w-[80%] mb-5"
              style={{ fontFamily: "var(--font-cert-display), serif" }}
            >
              {vm.title}
              {vm.isGradeCertificate && vm.associatedSchoolName && (
                <span className="block text-lg font-normal text-slate-600 mt-1">
                  at {vm.associatedSchoolName}
                </span>
              )}
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-sm text-slate-600">
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                  Completion Date
                </span>
                {formatDate(vm.issuedAt)}
              </div>
              {vm.instructorName && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                    Instructor
                  </span>
                  {vm.instructorName}
                </div>
              )}
              {showAffiliatedSchool && (
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                    Affiliated School
                  </span>
                  {vm.associatedSchoolName}
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="flex items-start justify-center gap-16 pb-2">
            <SignatureLine name="MEGA.EDU" title="MEGA.EDU Representative" />
            {showOrgSignature && (
              <SignatureLine name={vm.issuerName} title="Issuing Representative" />
            )}
            {vm.instructorName && <SignatureLine name={vm.instructorName} title="Instructor" />}
          </div>

          {/* Footer: verification */}
          <div className="flex items-end justify-between pt-4 border-t border-slate-200">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Certificate ID</p>
              <p className="font-mono text-xs text-slate-600">{vm.verificationCode}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Verify this certificate through MEGA.EDU — mega.edu/verify/{vm.verificationCode}
              </p>
            </div>
            <div className="w-16 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-center leading-tight shrink-0">
              <span className="text-[8px] text-slate-300">QR CODE</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
