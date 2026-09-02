import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import nepalGeography from "./data/nepal-geography.json";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@megaedu.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Platform Admin",
      passwordHash: adminPasswordHash,
      roles: { create: [{ role: "PLATFORM_ADMIN" }] },
    },
  });
  console.log(`Platform admin ready: ${adminEmail} / ${adminPassword}`);

  // Educational approaches
  const approaches = [
    { name: "Consciousness-Based Education", slug: "cbe" },
    { name: "STEM", slug: "stem" },
    { name: "Montessori", slug: "montessori" },
    { name: "Project-Based Learning", slug: "pbl" },
    { name: "Values Education", slug: "values" },
  ];
  for (const a of approaches) {
    await prisma.educationalApproach.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });
  }
  console.log(`Seeded ${approaches.length} educational approaches.`);

  // A demo verified school, so the directory isn't empty on first run
  const demoEmail = "demo.school@megaedu.local";
  const demoPasswordHash = await bcrypt.hash("DemoSchool123!", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo School Admin",
      passwordHash: demoPasswordHash,
      roles: { create: [{ role: "SCHOOL_ADMIN" }] },
    },
  });

  const cbe = await prisma.educationalApproach.findUnique({ where: { slug: "cbe" } });

  const demoSchool = await prisma.school.upsert({
    where: { slug: "sunrise-academy" },
    update: {},
    create: {
      name: "Sunrise Academy",
      slug: "sunrise-academy",
      location: "Kathmandu",
      gradesOffered: "1-10",
      description:
        "A demo school profile showing what a verified MEGA.EDU school listing looks like.",
      verified: true,
      contactEmail: "info@sunriseacademy.demo",
      programs: {
        create: [{ name: "After-school STEM Club", description: "Weekly hands-on STEM sessions." }],
      },
      news: {
        create: [{ title: "Welcome to MEGA.EDU", body: "Sunrise Academy has joined the network." }],
      },
    },
  });

  await prisma.schoolAdmin.upsert({
    where: { userId_schoolId: { userId: demoUser.id, schoolId: demoSchool.id } },
    update: {},
    create: { userId: demoUser.id, schoolId: demoSchool.id },
  });

  if (cbe) {
    await prisma.schoolApproach.upsert({
      where: { schoolId_approachId: { schoolId: demoSchool.id, approachId: cbe.id } },
      update: {},
      create: { schoolId: demoSchool.id, approachId: cbe.id },
    });
  }

  console.log(`Demo school ready: sunrise-academy (login: ${demoEmail} / DemoSchool123!)`);

  // Demo teacher (already approved, for easy testing)
  const teacherEmail = "demo.teacher@megaedu.local";
  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      email: teacherEmail,
      name: "Demo Teacher",
      passwordHash: await bcrypt.hash("DemoTeacher123!", 10),
      roles: { create: [{ role: "TEACHER" }] },
    },
  });
  await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      schoolId: demoSchool.id,
      subjects: "Mathematics",
      approved: true,
    },
  });
  console.log(`Demo teacher ready: ${teacherEmail} / DemoTeacher123! (pre-approved)`);

  // Demo student (already approved, for easy testing)
  const studentEmail = "demo.student@megaedu.local";
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      name: "Demo Student",
      passwordHash: await bcrypt.hash("DemoStudent123!", 10),
      roles: { create: [{ role: "STUDENT" }] },
    },
  });
  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      schoolId: demoSchool.id,
      gradeLevel: "Grade 9",
      approved: true,
    },
  });
  console.log(`Demo student ready: ${studentEmail} / DemoStudent123! (pre-approved)`);

  // Demo parent, linked to the demo student
  const parentEmail = "demo.parent@megaedu.local";
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {},
    create: {
      email: parentEmail,
      name: "Demo Parent",
      passwordHash: await bcrypt.hash("DemoParent123!", 10),
      roles: { create: [{ role: "PARENT" }] },
    },
  });
  const parentProfile = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });
  const studentProfile = await prisma.student.findUnique({ where: { userId: studentUser.id } });
  if (studentProfile) {
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: { parentId: parentProfile.id, studentId: studentProfile.id },
      },
      update: {},
      create: { parentId: parentProfile.id, studentId: studentProfile.id },
    });
  }
  console.log(`Demo parent ready: ${parentEmail} / DemoParent123! (linked to Demo Student)`);

  // Demo organization (pre-verified) with one published course, so the
  // MEGA Academy catalogue isn't empty on first run.
  const orgEmail = "demo.org@megaedu.local";
  const orgUser = await prisma.user.upsert({
    where: { email: orgEmail },
    update: {},
    create: {
      email: orgEmail,
      name: "Demo Org Admin",
      passwordHash: await bcrypt.hash("DemoOrg123!", 10),
      roles: { create: [{ role: "ORGANIZATION_ADMIN" }] },
    },
  });
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "mega-academy-labs" },
    update: {},
    create: {
      name: "MEGA Academy Labs",
      slug: "mega-academy-labs",
      description: "A demo course provider, verified and ready to publish training.",
      verified: true,
    },
  });
  await prisma.organizationAdmin.upsert({
    where: { userId_organizationId: { userId: orgUser.id, organizationId: demoOrg.id } },
    update: {},
    create: { userId: orgUser.id, organizationId: demoOrg.id },
  });

  const demoCourse = await prisma.course.upsert({
    where: { slug: "intro-to-cbe" },
    update: {},
    create: {
      organizationId: demoOrg.id,
      approachId: cbe?.id,
      title: "Introduction to Consciousness-Based Education",
      slug: "intro-to-cbe",
      description: "A short demo course showing how MEGA Academy course delivery works.",
      priceCents: 0,
      published: true,
    },
  });
  const demoModule = await prisma.courseModule.upsert({
    where: { id: "demo-module-1" }, // stable id so re-seeding doesn't duplicate
    update: {},
    create: {
      id: "demo-module-1",
      courseId: demoCourse.id,
      title: "Getting Started",
      order: 0,
    },
  });
  await prisma.lesson.upsert({
    where: { id: "demo-lesson-1" },
    update: {},
    create: {
      id: "demo-lesson-1",
      moduleId: demoModule.id,
      title: "What is Consciousness-Based Education?",
      content:
        "This is a demo lesson. In a real course, this is where the actual teaching content goes — text, images, or a linked video.",
      order: 0,
    },
  });
  console.log(
    `Demo organization ready: ${orgEmail} / DemoOrg123! — published course at /courses/intro-to-cbe`
  );

  // A couple of demo opportunities so /opportunities isn't empty on first run.
  await prisma.opportunity.upsert({
    where: { id: "demo-opportunity-1" },
    update: {},
    create: {
      id: "demo-opportunity-1",
      organizationId: demoOrg.id,
      title: "MEGA Academy Labs STEM Scholarship 2026",
      description: "A demo scholarship opportunity posted by a verified organization.",
      type: "Scholarship",
      deadline: new Date("2026-12-31"),
    },
  });
  await prisma.opportunity.upsert({
    where: { id: "demo-opportunity-2" },
    update: {},
    create: {
      id: "demo-opportunity-2",
      schoolId: demoSchool.id,
      title: "Sunrise Academy Inter-School Science Fair",
      description: "A demo competition opportunity posted by a verified school.",
      type: "Competition",
    },
  });
  console.log("Demo opportunities ready — visible at /opportunities");

  // Platform-wide grade ladder (Phase 2: Academic Sessions & Grades).
  // Fixed and seeded once — schools opt into these via SchoolGrade,
  // they never edit this list themselves.
  const gradeReferences = [
    { code: "PP1", order: 1 },
    { code: "PP2", order: 2 },
    { code: "PP3", order: 3 },
    { code: "Y1", order: 4 },
    { code: "Y2", order: 5 },
    { code: "Y3", order: 6 },
    { code: "Y4", order: 7 },
    { code: "Y5", order: 8 },
    { code: "Y6", order: 9 },
    { code: "Y7", order: 10 },
    { code: "Y8", order: 11 },
    { code: "Y9", order: 12 },
    { code: "Y10", order: 13 },
  ];
  for (const g of gradeReferences) {
    await prisma.gradeReference.upsert({
      where: { code: g.code },
      update: { order: g.order },
      create: g,
    });
  }
  console.log(`Seeded ${gradeReferences.length} grade references (PP1-PP3, Y1-Y10).`);

  // Nepal administrative geography (Phase A) — Province -> District ->
  // Local Level, vendored from prisma/data/nepal-geography.json (see
  // that file's _source/_note fields for provenance and the update
  // policy). Fixed, seeded reference data — never edited from the
  // application UI, same role GradeReference plays above. Upserted by
  // `code` so re-running this script is always safe.
  for (const p of nepalGeography.provinces) {
    await prisma.province.upsert({
      where: { code: p.code },
      update: { name: p.name, order: p.order },
      create: p,
    });
  }
  const provinces = await prisma.province.findMany({ select: { id: true, code: true } });
  const provinceIdByCode = new Map(provinces.map((p) => [p.code, p.id]));

  for (const d of nepalGeography.districts) {
    const provinceId = provinceIdByCode.get(d.provinceCode);
    if (!provinceId) throw new Error(`Seed data error: district ${d.code} references unknown province ${d.provinceCode}`);
    await prisma.district.upsert({
      where: { code: d.code },
      update: { name: d.name, provinceId },
      create: { code: d.code, name: d.name, provinceId },
    });
  }
  const districts = await prisma.district.findMany({ select: { id: true, code: true } });
  const districtIdByCode = new Map(districts.map((d) => [d.code, d.id]));

  for (const l of nepalGeography.localLevels) {
    const districtId = districtIdByCode.get(l.districtCode);
    if (!districtId) throw new Error(`Seed data error: local level ${l.code} references unknown district ${l.districtCode}`);
    await prisma.localLevel.upsert({
      where: { code: l.code },
      update: { name: l.name, type: l.type, wardCount: l.wardCount, districtId },
      create: { code: l.code, name: l.name, type: l.type, wardCount: l.wardCount, districtId },
    });
  }
  console.log(
    `Seeded Nepal geography: ${nepalGeography.provinces.length} provinces, ${nepalGeography.districts.length} districts, ${nepalGeography.localLevels.length} local levels.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
