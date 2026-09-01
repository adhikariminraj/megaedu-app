import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HomeHero from "@/components/home/HomeHero";
import WhyMegaEdu from "@/components/home/WhyMegaEdu";
import HowItWorks from "@/components/home/HowItWorks";
import SeeItInAction from "@/components/home/SeeItInAction";
import WhatWeOffer from "@/components/home/WhatWeOffer";
import ExploreNetwork from "@/components/home/ExploreNetwork";
import FinalCta from "@/components/home/FinalCta";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  const [recentSchools, courses, opportunities, approaches, certificate] = await Promise.all([
    prisma.school.findMany({
      where: { verified: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, slug: true, name: true, location: true },
    }),
    prisma.course.findMany({
      where: { published: true },
      include: { organization: true, approach: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.opportunity.findMany({
      include: { school: true, organization: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.educationalApproach.findMany({ take: 4 }),
    // Matches the certificate captured in public/screenshots/certificate.png,
    // so the "See It in Action" example and its verify link show the same record.
    prisma.certificate.findFirst({
      where: { verificationCode: "cmtifgh5z022u8jx1yzqzja4u" },
      select: { verificationCode: true },
    }),
  ]);

  const certificateVerifyUrl = certificate ? `/verify/${certificate.verificationCode}` : null;

  return (
    <div>
      <HomeHero isLoggedIn={isLoggedIn} />
      <WhyMegaEdu />
      <HowItWorks />
      <SeeItInAction certificateVerifyUrl={certificateVerifyUrl} />
      <WhatWeOffer />
      <ExploreNetwork
        schools={recentSchools}
        courses={courses}
        opportunities={opportunities}
        approaches={approaches}
      />
      <FinalCta isLoggedIn={isLoggedIn} />
    </div>
  );
}
