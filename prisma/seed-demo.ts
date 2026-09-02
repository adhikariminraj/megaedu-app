// MEGA.EDU — Demo/Sample Data
//
// Run AFTER `npm run db:seed` (the minimal bootstrap). This script builds a
// full, realistic multi-school demo environment on top of it: academic
// sessions, grades/sections, subjects, teacher assignments, students with
// genuine promotion history, a complete assessment system with published
// results, attendance, evaluations, unit tests, parent-teacher meetings,
// parents, and course enrollments.
//
// Idempotent: every row is created via upsert on either the model's own
// natural unique constraint, or (for append-only audit/log tables with no
// natural key) a stable, deterministic `id`. Re-running this script against
// an already-seeded database is safe and makes no duplicate rows.
//
// Reset recipe:
//   npx prisma db push --force-reset
//   npm run db:seed
//   npm run db:seed:demo
//
// All data is fictional. Every account uses the shared password below.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "MegaDemo123!";
let demoPasswordHash: string;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) so re-seeding produces byte-identical
// results every time — "reproducible" means the same names, marks, and
// attendance every run, not merely "no crashes on re-run."
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260831);
function randInt(min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const MALE_FIRST = [
  "Suresh", "Ramesh", "Bishnu", "Prakash", "Rajesh", "Kiran", "Sandeep", "Nabin", "Bikash", "Sujan",
  "Dipesh", "Sagar", "Anish", "Rohan", "Aarav", "Prashant", "Sabin", "Yubraj", "Nirmal", "Pradeep",
  "Bibek", "Manoj", "Ganesh", "Hari", "Krishna", "Alok", "Deepak", "Sunil", "Tej", "Milan",
];
const FEMALE_FIRST = [
  "Anita", "Sita", "Maya", "Sunita", "Kamala", "Sarita", "Anjali", "Sabina", "Puja", "Nisha",
  "Rina", "Sabitri", "Bimala", "Sunmaya", "Rekha", "Sanju", "Roshani", "Kalpana", "Deepika", "Manisha",
  "Sristi", "Sabnam", "Laxmi", "Radha", "Gita", "Nirmala", "Pratikshya", "Sujata", "Bindu", "Asmita",
];
const LAST_NAMES = [
  "Sharma", "Thapa", "Gurung", "Rai", "K.C.", "Adhikari", "Lama", "Shrestha", "Basnet", "Karki",
  "Poudel", "Bhandari", "Magar", "Tamang", "Chettri", "Khadka", "Bista", "Neupane", "Acharya", "Subedi",
  "Bhattarai", "Pandey", "Regmi", "Bogati", "Ghimire", "Rana", "Joshi", "Dahal", "Paudel", "Baral",
];

let emailCounter = 0;
function personName(gender: "M" | "F") {
  const first = gender === "M" ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
  const last = pick(LAST_NAMES);
  return { first, last, full: `${first} ${last}`, gender };
}
function slugPart(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function emailFor(first: string, last: string) {
  emailCounter += 1;
  return `${slugPart(first)}.${slugPart(last)}${emailCounter}@megaedu.local`;
}

// find-or-create for AcademicSession, returning a guaranteed non-null,
// concretely-typed row (avoids TS "possibly null" noise from `let x | null`
// spanning many later closures).
async function ensureSession(
  schoolId: string,
  where: { status?: string; name?: string },
  data: { name: string; startDate: string; endDate: string; status: string }
) {
  const existing = await prisma.academicSession.findFirst({ where: { schoolId, ...where } });
  if (existing) return existing;
  return prisma.academicSession.create({
    data: { schoolId, name: data.name, startDate: new Date(data.startDate), endDate: new Date(data.endDate), status: data.status },
  });
}

async function upsertUser(email: string, name: string, role: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash: demoPasswordHash,
      roles: { create: [{ role }] },
    },
  });
}

// ---------------------------------------------------------------------------
async function main() {
  demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  console.log(`Demo password for every account created by this script: ${DEMO_PASSWORD}`);

  // =========================================================================
  // SUNRISE ACADEMY — resolve the existing school/session/roster this script
  // builds on top of (all created by seed.ts / earlier manual testing).
  // =========================================================================
  const sunrise = await prisma.school.upsert({
    where: { slug: "sunrise-academy" },
    update: {},
    create: {
      name: "Sunrise Academy",
      slug: "sunrise-academy",
      location: "Kathmandu",
      gradesOffered: "1-10",
      description: "A demo school profile showing what a verified MEGA.EDU school listing looks like.",
      verified: true,
      contactEmail: "info@sunriseacademy.demo",
    },
  });

  const schoolAdminUser = await prisma.user.findUniqueOrThrow({ where: { email: "demo.school@megaedu.local" } });

  const gY6 = await prisma.gradeReference.findUniqueOrThrow({ where: { code: "Y6" } });
  const gY8 = await prisma.gradeReference.findUniqueOrThrow({ where: { code: "Y8" } });
  const gY9 = await prisma.gradeReference.findUniqueOrThrow({ where: { code: "Y9" } });

  const class6 = await prisma.schoolGrade.upsert({
    where: { schoolId_gradeReferenceId: { schoolId: sunrise.id, gradeReferenceId: gY6.id } },
    update: {},
    create: { schoolId: sunrise.id, gradeReferenceId: gY6.id, displayName: "Class 6" },
  });
  const class9 = await prisma.schoolGrade.upsert({
    where: { schoolId_gradeReferenceId: { schoolId: sunrise.id, gradeReferenceId: gY9.id } },
    update: {},
    create: { schoolId: sunrise.id, gradeReferenceId: gY9.id, displayName: "Class 9" },
  });

  // Current active session (2026-2027) — created by earlier manual testing;
  // upsert-safe if this is instead run from a fresh reset.
  const activeSession = await ensureSession(
    sunrise.id,
    { status: "ACTIVE" },
    { name: "2026-2027", startDate: "2026-04-15", endDate: "2027-04-14", status: "ACTIVE" }
  );

  // A prior, CLOSED session — needed so the "Repeated" badge and normal
  // Class-8-to-Class-9 promotions can be demonstrated with genuine history,
  // not a fabricated label.
  const priorSession = await ensureSession(
    sunrise.id,
    { name: "2025-2026" },
    { name: "2025-2026", startDate: "2025-04-15", endDate: "2026-04-14", status: "CLOSED" }
  );
  // Class 8 is only needed as the "grade students were promoted FROM" —
  // opted into once, referenced by prior-session history only.
  const class8 = await prisma.schoolGrade.upsert({
    where: { schoolId_gradeReferenceId: { schoolId: sunrise.id, gradeReferenceId: gY8.id } },
    update: {},
    create: { schoolId: sunrise.id, gradeReferenceId: gY8.id, displayName: "Class 8" },
  });

  // Sections: Class 9 A-F already exist from earlier work; Class 6 gets two
  // new ones.
  const sectionNamesC9 = ["A", "B", "C", "D", "E", "F"];
  const sectionsC9: Record<string, { id: string }> = {};
  for (const name of sectionNamesC9) {
    sectionsC9[name] = await prisma.section.upsert({
      where: { schoolGradeId_name: { schoolGradeId: class9.id, name } },
      update: {},
      create: { schoolGradeId: class9.id, name },
    });
  }
  const sectionNamesC6 = ["A", "B"];
  const sectionsC6: Record<string, { id: string }> = {};
  for (const name of sectionNamesC6) {
    sectionsC6[name] = await prisma.section.upsert({
      where: { schoolGradeId_name: { schoolGradeId: class6.id, name } },
      update: {},
      create: { schoolGradeId: class6.id, name },
    });
  }

  // Subjects — Mathematics/Science/IT already exist; add English/Nepali/
  // Social Studies.
  const subjectNames = ["Mathematics", "Science", "IT", "English", "Nepali", "Social Studies"];
  const subjects: Record<string, { id: string }> = {};
  for (const name of subjectNames) {
    subjects[name] = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: sunrise.id, name } },
      update: {},
      create: { schoolId: sunrise.id, name },
    });
  }

  // Grade offerings for the active session.
  const c9SubjectNames = ["Mathematics", "Science", "IT", "English", "Nepali", "Social Studies"];
  const gradeSubjectsC9: Record<string, { id: string }> = {};
  for (const name of c9SubjectNames) {
    gradeSubjectsC9[name] = await prisma.gradeSubject.upsert({
      where: {
        schoolGradeId_subjectId_academicSessionId: {
          schoolGradeId: class9.id,
          subjectId: subjects[name].id,
          academicSessionId: activeSession.id,
        },
      },
      update: {},
      create: { schoolGradeId: class9.id, subjectId: subjects[name].id, academicSessionId: activeSession.id },
    });
  }
  const c6SubjectNames = ["Mathematics", "English", "Science"];
  const gradeSubjectsC6: Record<string, { id: string }> = {};
  for (const name of c6SubjectNames) {
    gradeSubjectsC6[name] = await prisma.gradeSubject.upsert({
      where: {
        schoolGradeId_subjectId_academicSessionId: {
          schoolGradeId: class6.id,
          subjectId: subjects[name].id,
          academicSessionId: activeSession.id,
        },
      },
      update: {},
      create: { schoolGradeId: class6.id, subjectId: subjects[name].id, academicSessionId: activeSession.id },
    });
  }

  // ---------------------------------------------------------------------
  // Teachers
  // ---------------------------------------------------------------------
  // demo.teacher@megaedu.local is created by seed.ts's own baseline — always
  // present. demo2.teacher@megaedu.local ("Bimla") is NOT in seed.ts (she was
  // created by earlier manual testing); this script must be able to (re)create
  // her from a bare seed.ts baseline too, so it's fully self-sufficient on a
  // fresh `db push --force-reset`.
  const demoTeacherUser = await prisma.user.findUniqueOrThrow({ where: { email: "demo.teacher@megaedu.local" } });
  const demoTeacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: demoTeacherUser.id } });

  async function ensureTeacher(email: string, name: string, position: string, subjectsLabel?: string) {
    const u = await upsertUser(email, name, "TEACHER");
    const t = await prisma.teacher.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, schoolId: sunrise.id, approved: true, position, subjects: subjectsLabel },
    });
    return { user: u, teacher: t };
  }

  const bimlaEnsured = await ensureTeacher("demo2.teacher@megaedu.local", "Bimla", "Teacher", "IT, Mathematics, Science");
  const bimlaUser = bimlaEnsured.user;
  const bimla = bimlaEnsured.teacher;

  const suresh = await ensureTeacher("suresh.sharma.math@megaedu.local", "Suresh Sharma", "Mathematics Teacher");
  const anita = await ensureTeacher("anita.gurung.eng@megaedu.local", "Anita Gurung", "English Teacher");
  const ramesh = await ensureTeacher("ramesh.thapa.nep@megaedu.local", "Ramesh Thapa", "Nepali Teacher");
  const sita = await ensureTeacher("sita.rai.soc@megaedu.local", "Sita Rai", "Social Studies Teacher");
  const prakash = await ensureTeacher("prakash.kc.sci@megaedu.local", "Prakash K.C.", "Science Teacher");
  const bishnu = await ensureTeacher("bishnu.adhikari.comp@megaedu.local", "Bishnu Adhikari", "Computer Teacher");
  const maya = await ensureTeacher("maya.lama.c6@megaedu.local", "Maya Lama", "Class 6 Class Teacher");

  async function ensureTGA(teacherId: string, schoolGradeId: string) {
    await prisma.teacherGradeAssignment.upsert({
      where: { teacherId_schoolGradeId_academicSessionId: { teacherId, schoolGradeId, academicSessionId: activeSession.id } },
      update: {},
      create: { teacherId, schoolGradeId, academicSessionId: activeSession.id },
    });
  }
  for (const t of [suresh, anita, ramesh, sita, prakash, bishnu]) await ensureTGA(t.teacher.id, class9.id);
  await ensureTGA(maya.teacher.id, class6.id);
  await ensureTGA(suresh.teacher.id, class6.id);
  await ensureTGA(anita.teacher.id, class6.id);

  // Prisma's compound-unique upsert shortcut can't take `null` for a
  // nullable field in the key (the client rejects it, even though the
  // schema's own @@unique allows it — the same NULL-in-unique-index
  // situation documented throughout this schema). For grade-wide rows
  // (sectionId: null) we fall back to a plain findFirst + create, exactly
  // like the app's own pre-check helpers (e.g. assignmentCollisionExists())
  // already do for this identical case.
  async function ensureTAA(teacherId: string, subjectName: string, sectionId: string | null, grade: "C9" | "C6") {
    const gradeSubject = grade === "C9" ? gradeSubjectsC9[subjectName] : gradeSubjectsC6[subjectName];
    const schoolGradeId = grade === "C9" ? class9.id : class6.id;
    if (sectionId) {
      return prisma.teacherAcademicAssignment.upsert({
        where: {
          teacherId_academicSessionId_schoolGradeId_sectionId_subjectId: {
            teacherId,
            academicSessionId: activeSession.id,
            schoolGradeId,
            sectionId,
            subjectId: subjects[subjectName].id,
          },
        },
        update: {},
        create: { teacherId, academicSessionId: activeSession.id, schoolGradeId, sectionId, subjectId: subjects[subjectName].id, gradeSubjectId: gradeSubject.id },
      });
    }
    const existing = await prisma.teacherAcademicAssignment.findFirst({
      where: { teacherId, academicSessionId: activeSession.id, schoolGradeId, sectionId: null, subjectId: subjects[subjectName].id },
    });
    if (existing) return existing;
    return prisma.teacherAcademicAssignment.create({
      data: { teacherId, academicSessionId: activeSession.id, schoolGradeId, sectionId: null, subjectId: subjects[subjectName].id, gradeSubjectId: gradeSubject.id },
    });
  }

  // Bimla: Mathematics 9A/9B, Science 9E (her original assignments — created
  // here so they exist even from a bare seed.ts baseline).
  await ensureTAA(bimla.id, "Mathematics", sectionsC9["A"].id, "C9");
  await ensureTAA(bimla.id, "Mathematics", sectionsC9["B"].id, "C9");
  await ensureTAA(bimla.id, "Science", sectionsC9["E"].id, "C9");
  // Suresh: Mathematics for 9C/9D (the two sections Bimla doesn't cover).
  await ensureTAA(suresh.teacher.id, "Mathematics", sectionsC9["C"].id, "C9");
  await ensureTAA(suresh.teacher.id, "Mathematics", sectionsC9["D"].id, "C9");
  await ensureTAA(suresh.teacher.id, "Mathematics", null, "C6");
  // Grade-wide subject teachers for the newly-offered subjects.
  await ensureTAA(anita.teacher.id, "English", null, "C9");
  await ensureTAA(anita.teacher.id, "English", null, "C6");
  await ensureTAA(ramesh.teacher.id, "Nepali", null, "C9");
  await ensureTAA(sita.teacher.id, "Social Studies", null, "C9");
  await ensureTAA(prakash.teacher.id, "Science", null, "C9");
  await ensureTAA(bishnu.teacher.id, "IT", null, "C9");
  await ensureTAA(maya.teacher.id, "Science", null, "C6");

  async function ensureCTA(teacherId: string, schoolGradeId: string, sectionId: string | null) {
    if (sectionId) {
      return prisma.classTeacherAssignment.upsert({
        where: { schoolGradeId_sectionId_academicSessionId: { schoolGradeId, sectionId, academicSessionId: activeSession.id } },
        update: {},
        create: { teacherId, schoolGradeId, sectionId, academicSessionId: activeSession.id },
      });
    }
    const existing = await prisma.classTeacherAssignment.findFirst({ where: { schoolGradeId, sectionId: null, academicSessionId: activeSession.id } });
    if (existing) return existing;
    return prisma.classTeacherAssignment.create({ data: { teacherId, schoolGradeId, sectionId: null, academicSessionId: activeSession.id } });
  }
  // Demo Teacher: Class 9 Grade Coordinator (existing).
  await ensureCTA(demoTeacher.id, class9.id, null);
  // Bimla: Class Teacher, 9A (existing) — combined with her subject
  // teaching assignments above, demonstrating one Teacher holding both
  // Subject Teaching Assignments and a Class Teacher responsibility.
  await ensureCTA(bimla.id, class9.id, sectionsC9["A"].id);
  // Suresh: Class Teacher, 9C (new — shows Grade Coordinator + Class
  // Teacher coexisting for the same grade, on different teachers).
  await ensureCTA(suresh.teacher.id, class9.id, sectionsC9["C"].id);
  // Maya: Class 6 Grade Coordinator.
  await ensureCTA(maya.teacher.id, class6.id, null);

  // ---------------------------------------------------------------------
  // Grading scale, assessment framework, periods, First Term components,
  // and the grade-default assignment — all created here (upsert-if-missing)
  // so this script is fully self-sufficient from a bare seed.ts baseline,
  // not dependent on the specific manual-testing state this repo happened
  // to be in. Where a row already exists (as it does today), its values are
  // matched exactly rather than duplicated. The only edit to a pre-existing
  // row anywhere in this script is filling in the previously-null
  // gradePoint/isPassing fields on the bands below.
  // ---------------------------------------------------------------------
  const scale = await prisma.gradingScale.upsert({
    where: { schoolId_name: { schoolId: sunrise.id, name: "Class 9 Assessment Grade Levels" } },
    update: {},
    create: { schoolId: sunrise.id, name: "Class 9 Assessment Grade Levels" },
  });
  const bandShape: { minPercent: number; maxPercent: number; label: string; gradePoint: number; isPassing: boolean; order: number }[] = [
    { minPercent: 90, maxPercent: 100, label: "A+", gradePoint: 4.0, isPassing: true, order: 0 },
    { minPercent: 80, maxPercent: 90, label: "A", gradePoint: 3.6, isPassing: true, order: 1 },
    { minPercent: 70, maxPercent: 80, label: "B+", gradePoint: 3.2, isPassing: true, order: 2 },
    { minPercent: 60, maxPercent: 70, label: "B", gradePoint: 2.8, isPassing: true, order: 3 },
    { minPercent: 40, maxPercent: 60, label: "C", gradePoint: 2.0, isPassing: true, order: 4 },
    { minPercent: 0, maxPercent: 40, label: "D", gradePoint: 1.0, isPassing: false, order: 5 },
  ];
  const existingBands = await prisma.gradingScaleBand.findMany({ where: { gradingScaleId: scale.id } });
  for (const b of bandShape) {
    const existing = existingBands.find((x) => x.label === b.label);
    if (existing) {
      if (existing.gradePoint == null) {
        await prisma.gradingScaleBand.update({ where: { id: existing.id }, data: { gradePoint: b.gradePoint, isPassing: b.isPassing } });
      }
    } else {
      await prisma.gradingScaleBand.create({
        data: { gradingScaleId: scale.id, minPercent: b.minPercent, maxPercent: b.maxPercent, label: b.label, gradePoint: b.gradePoint, isPassing: b.isPassing, order: b.order },
      });
    }
  }
  console.log(`Grading scale "${scale.name}" ready, with gradePoint/isPassing set on every band.`);

  // AssessmentComponentResult is uniquely keyed by (componentId, studentId)
  // alone -- there is no subject dimension in that constraint. So if two
  // different subjects both resolved to the SAME grade-default framework's
  // SAME component rows, their marks would collide on that key and silently
  // overwrite each other (caught live during this script's own verification
  // pass: Science's entries were no-op'd onto Mathematics's rows). Real
  // schools handle this exactly the way ASSESSMENT_FRAMEWORK.md's own
  // "Computer: Theory 50/Practical 50" example does -- a subject that needs
  // independently-tracked marks gets its own framework via a subject-
  // specific AssessmentFrameworkAssignment override. So: Mathematics and
  // Science each get their own dedicated framework (reusing the same
  // grading scale); "Class 9 Assessment" remains the grade-default,
  // covering IT/English/Nepali/Social Studies, none of which this script
  // enters independently-varying marks against, so no collision there.
  const componentShape = [
    { name: "Unit Test", maxMarks: 10 },
    { name: "Home Work", maxMarks: 10 },
    { name: "Port Folio", maxMarks: 10 },
    { name: "Written Exam", maxMarks: 20 },
  ];
  const periodNames = ["First Term", "Mid Term", "Second Term", "Final Term"];

  async function ensureFramework(name: string, gradeSubjectId: string | null) {
    const framework = await prisma.assessmentFramework.upsert({
      where: { schoolId_name: { schoolId: sunrise.id, name } },
      update: {},
      create: { schoolId: sunrise.id, name, gradingScaleId: scale.id },
    });
    const periods: Record<string, { id: string }> = {};
    for (let i = 0; i < periodNames.length; i++) {
      periods[periodNames[i]] = await prisma.assessmentPeriod.upsert({
        where: { frameworkId_name: { frameworkId: framework.id, name: periodNames[i] } },
        update: {},
        create: { frameworkId: framework.id, name: periodNames[i], order: i },
      });
    }
    async function ensurePeriodComponents(periodName: string) {
      const period = periods[periodName];
      const result = [];
      let order = 0;
      for (const c of componentShape) {
        result.push(
          await prisma.assessmentComponent.upsert({
            where: { frameworkId_periodId_name: { frameworkId: framework.id, periodId: period.id, name: c.name } },
            update: {},
            create: { frameworkId: framework.id, periodId: period.id, name: c.name, maxMarks: c.maxMarks, entryMode: "MARKS", order: order++ },
          })
        );
      }
      return result;
    }
    const firstTermComponents = await ensurePeriodComponents("First Term");
    const secondTermComponents = await ensurePeriodComponents("Second Term");

    const existingAssignment = await prisma.assessmentFrameworkAssignment.findFirst({
      where: { academicSessionId: activeSession.id, schoolGradeId: class9.id, gradeSubjectId },
    });
    const assignment =
      existingAssignment ??
      (await prisma.assessmentFrameworkAssignment.create({
        data: { schoolId: sunrise.id, academicSessionId: activeSession.id, schoolGradeId: class9.id, gradeSubjectId, frameworkId: framework.id },
      }));
    return { framework, assignment, firstTermComponents, secondTermComponents };
  }

  const gradeDefaultFramework = await ensureFramework("Class 9 Assessment", null);
  const mathFramework = await ensureFramework("Mathematics Assessment", gradeSubjectsC9["Mathematics"].id);
  const scienceFramework = await ensureFramework("Science Assessment", gradeSubjectsC9["Science"].id);
  console.log('Assessment frameworks ready: "Class 9 Assessment" (grade default), "Mathematics Assessment" and "Science Assessment" (subject overrides), each with First + Second Term components.');

  // ---------------------------------------------------------------------
  // Students — Class 9, sections A-D populated, plus two unassigned.
  // Mix of promotion histories: ~19 promoted-regular (Class 8 -> Class 9),
  // 1 repeated (demonstrates the Repeated badge genuinely), ~13 newly
  // enrolled (no prior row at all).
  // ---------------------------------------------------------------------
  type NewStudent = { user: any; student: any; gender: "M" | "F"; ability: { math: number; science: number } };

  async function ensureStudentUser(gender: "M" | "F") {
    const n = personName(gender);
    const email = emailFor(n.first, n.last);
    const u = await upsertUser(email, n.full, "STUDENT");
    const s = await prisma.student.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, schoolId: sunrise.id, approved: true },
    });
    return { user: u, student: s, gender };
  }

  async function placeCurrentSession(studentId: string, schoolGradeId: string, sectionId: string | null, status = "ENROLLED") {
    return prisma.gradeHistory.upsert({
      where: { studentId_academicSessionId: { studentId, academicSessionId: activeSession.id } },
      update: {},
      create: { studentId, schoolGradeId, sectionId, academicSessionId: activeSession.id, status },
    });
  }

  async function priorHistoryPromoted(studentId: string) {
    // Prior year: Class 8, decided COMPLETED -> promoted into Class 9.
    const row = await prisma.gradeHistory.upsert({
      where: { studentId_academicSessionId: { studentId, academicSessionId: priorSession!.id } },
      update: {},
      create: {
        studentId,
        schoolGradeId: class8.id,
        academicSessionId: priorSession!.id,
        status: "COMPLETED",
        decidedAt: new Date("2026-04-01"),
        decidedByUserId: schoolAdminUser.id,
        outcomeGradeId: class9.id,
      },
    });
    await prisma.gradeHistoryAudit.upsert({
      where: { id: `gha-promoted-${studentId}` },
      update: {},
      create: {
        id: `gha-promoted-${studentId}`,
        gradeHistoryId: row.id,
        changedByUserId: schoolAdminUser.id,
        changedAt: new Date("2026-04-01"),
        previousStatus: "ENROLLED",
        previousOutcomeGradeId: null,
        previousSectionId: null,
        newStatus: "COMPLETED",
        newOutcomeGradeId: class9.id,
        newSectionId: null,
      },
    });
  }

  async function priorHistoryRepeated(studentId: string) {
    // Prior year: Class 9 itself, decided REPEATED -> back into Class 9.
    const row = await prisma.gradeHistory.upsert({
      where: { studentId_academicSessionId: { studentId, academicSessionId: priorSession!.id } },
      update: {},
      create: {
        studentId,
        schoolGradeId: class9.id,
        academicSessionId: priorSession!.id,
        status: "REPEATED",
        decidedAt: new Date("2026-04-01"),
        decidedByUserId: schoolAdminUser.id,
        outcomeGradeId: class9.id,
      },
    });
    await prisma.gradeHistoryAudit.upsert({
      where: { id: `gha-repeated-${studentId}` },
      update: {},
      create: {
        id: `gha-repeated-${studentId}`,
        gradeHistoryId: row.id,
        changedByUserId: schoolAdminUser.id,
        changedAt: new Date("2026-04-01"),
        previousStatus: "ENROLLED",
        previousOutcomeGradeId: null,
        previousSectionId: null,
        newStatus: "REPEATED",
        newOutcomeGradeId: class9.id,
        newSectionId: null,
      },
    });
  }

  const c9Students: NewStudent[] = [];
  const sectionPlan: { name: string; count: number }[] = [
    { name: "A", count: 8 },
    { name: "B", count: 8 },
    { name: "C", count: 8 },
    { name: "D", count: 7 }, // + existing Demo Student = 8
  ];

  let repeatedAssigned = false;
  let promotedCount = 0;
  const TARGET_PROMOTED = 19;

  for (const sec of sectionPlan) {
    for (let i = 0; i < sec.count; i++) {
      const gender = rng() < 0.5 ? "M" : "F";
      const ns = await ensureStudentUser(gender);
      const ability = { math: clamp(rng() * 0.65 + 0.3, 0.3, 0.97), science: clamp(rng() * 0.65 + 0.3, 0.3, 0.97) };
      c9Students.push({ ...ns, ability });

      if (sec.name === "B" && !repeatedAssigned) {
        await priorHistoryRepeated(ns.student.id);
        repeatedAssigned = true;
      } else if (promotedCount < TARGET_PROMOTED) {
        await priorHistoryPromoted(ns.student.id);
        promotedCount++;
      }
      // else: no prior row at all -> genuinely newly enrolled this year.

      await placeCurrentSession(ns.student.id, class9.id, sectionsC9[sec.name].id);
    }
  }
  // Two genuinely unassigned students (placed in the grade, no section yet).
  for (let i = 0; i < 2; i++) {
    const gender = rng() < 0.5 ? "M" : "F";
    const ns = await ensureStudentUser(gender);
    const ability = { math: clamp(rng() * 0.6 + 0.3, 0.3, 0.9), science: clamp(rng() * 0.6 + 0.3, 0.3, 0.9) };
    c9Students.push({ ...ns, ability });
    await placeCurrentSession(ns.student.id, class9.id, null);
  }

  // Fold in the well-known Demo Student (Section D) — given a REPEATED
  // decision for *next* session, a different, equally valid demo from the
  // dedicated "repeated" student above: an already-decided student who still
  // correctly appears on Class Overview this year, since the year isn't
  // over. Placed explicitly here (not assumed pre-existing) so this script
  // is self-sufficient from a bare seed.ts baseline.
  const demoStudentUser = await prisma.user.findUniqueOrThrow({ where: { email: "demo.student@megaedu.local" } });
  const demoStudent = await prisma.student.findUniqueOrThrow({ where: { userId: demoStudentUser.id } });
  const demoStudentHistory = await prisma.gradeHistory.upsert({
    where: { studentId_academicSessionId: { studentId: demoStudent.id, academicSessionId: activeSession.id } },
    update: {},
    create: {
      studentId: demoStudent.id,
      schoolGradeId: class9.id,
      sectionId: sectionsC9["D"].id,
      academicSessionId: activeSession.id,
      status: "REPEATED",
      decidedAt: new Date("2026-08-15"),
      decidedByUserId: schoolAdminUser.id,
      outcomeGradeId: class9.id,
    },
  });
  await prisma.gradeHistoryAudit.upsert({
    where: { id: `gha-demo-student-repeated` },
    update: {},
    create: {
      id: `gha-demo-student-repeated`,
      gradeHistoryId: demoStudentHistory.id,
      changedByUserId: schoolAdminUser.id,
      changedAt: new Date("2026-08-15"),
      previousStatus: "ENROLLED",
      previousOutcomeGradeId: null,
      previousSectionId: sectionsC9["D"].id,
      newStatus: "REPEATED",
      newOutcomeGradeId: class9.id,
      newSectionId: sectionsC9["D"].id,
    },
  });
  c9Students.push({
    user: demoStudentUser,
    student: demoStudent,
    gender: "M",
    ability: { math: clamp(rng() * 0.5 + 0.4, 0.3, 0.95), science: clamp(rng() * 0.5 + 0.4, 0.3, 0.95) },
  });

  console.log(`Class 9 roster ready: ${c9Students.length} students across sections A-D (+2 unassigned).`);

  // ---------------------------------------------------------------------
  // Students — Class 6, sections A/B, simple fresh enrollments.
  // ---------------------------------------------------------------------
  const c6Students: NewStudent[] = [];
  for (const sec of [{ name: "A", count: 6 }, { name: "B", count: 6 }]) {
    for (let i = 0; i < sec.count; i++) {
      const gender = rng() < 0.5 ? "M" : "F";
      const ns = await ensureStudentUser(gender);
      c6Students.push({ ...ns, gender, ability: { math: 0.5, science: 0.5 } });
      await placeCurrentSession(ns.student.id, class6.id, sectionsC6[sec.name].id);
    }
  }
  console.log(`Class 6 roster ready: ${c6Students.length} students across sections A/B.`);

  // ---------------------------------------------------------------------
  // Assessment results — Mathematics & Science, both terms, published, for
  // every Class 9 A-D student (including Demo Student). Deliberately varied
  // marks (per-student ability + noise), not uniform.
  // ---------------------------------------------------------------------
  function markFor(maxMarks: number, ability: number) {
    const noise = (rng() - 0.5) * maxMarks * 0.35;
    return Math.round(clamp(ability * maxMarks + noise, 0, maxMarks) * 2) / 2;
  }

  const absentSlots = new Set<string>();
  // Two students get one ABSENT component each (Math, Second Term, Written Exam).
  absentSlots.add(c9Students[3].student.id);
  absentSlots.add(c9Students[12 % c9Students.length].student.id);

  async function enterAndPublishSubject(
    subjectName: string,
    abilityKey: "math" | "science",
    teacherUserId: string,
    fw: { assignment: { id: string }; firstTermComponents: { id: string; name: string; maxMarks: number; periodId: string | null }[]; secondTermComponents: { id: string; name: string; maxMarks: number; periodId: string | null }[] }
  ) {
    const gradeSubject = gradeSubjectsC9[subjectName];
    for (const s of c9Students) {
      const ability = s.ability[abilityKey];
      for (const comp of [...fw.firstTermComponents, ...fw.secondTermComponents]) {
        const isAbsentSlot = absentSlots.has(s.student.id) && comp.name === "Written Exam" && fw.secondTermComponents.some((c) => c.id === comp.id);
        await prisma.assessmentComponentResult.upsert({
          where: { componentId_studentId: { componentId: comp.id, studentId: s.student.id } },
          update: {},
          create: {
            componentId: comp.id,
            gradeSubjectId: gradeSubject.id,
            assignmentId: fw.assignment.id,
            studentId: s.student.id,
            status: isAbsentSlot ? "ABSENT" : "EVALUATED",
            marksObtained: isAbsentSlot ? null : markFor(comp.maxMarks, ability),
            evaluatedByUserId: teacherUserId,
            evaluatedAt: new Date("2026-08-20"),
          },
        });
      }
      await prisma.assessmentResultPublication.upsert({
        where: { gradeSubjectId_studentId: { gradeSubjectId: gradeSubject.id, studentId: s.student.id } },
        update: {},
        create: {
          gradeSubjectId: gradeSubject.id,
          studentId: s.student.id,
          assignmentId: fw.assignment.id,
          status: "PUBLISHED",
          publishedAt: new Date("2026-08-22"),
          publishedByUserId: teacherUserId,
        },
      });
    }
    console.log(`Published ${subjectName} results (First + Second Term) for ${c9Students.length} Class 9 students, via its own dedicated framework.`);
  }

  await enterAndPublishSubject("Mathematics", "math", bimlaUser.id, mathFramework);
  await enterAndPublishSubject("Science", "science", prakash.user.id, scienceFramework);

  // IT — deliberately left as an unpublished draft, for 3 students, First
  // Term only, to demonstrate "entered but not yet visible to Student/Parent."
  // Uses the shared grade-default framework/components -- safe here since no
  // other subject in this script enters marks against that same framework.
  const itGradeSubject = gradeSubjectsC9["IT"];
  for (const s of c9Students.slice(0, 3)) {
    for (const comp of gradeDefaultFramework.firstTermComponents) {
      await prisma.assessmentComponentResult.upsert({
        where: { componentId_studentId: { componentId: comp.id, studentId: s.student.id } },
        update: {},
        create: {
          componentId: comp.id,
          gradeSubjectId: itGradeSubject.id,
          assignmentId: gradeDefaultFramework.assignment.id,
          studentId: s.student.id,
          status: "EVALUATED",
          marksObtained: markFor(comp.maxMarks, s.ability.math),
          evaluatedByUserId: bishnu.user.id,
          evaluatedAt: new Date("2026-08-25"),
        },
      });
    }
    // Publication row intentionally NOT created -> stays a non-existent
    // (implicitly DRAFT-equivalent, since no publication row exists until
    // first entry in the real app flow would create one at DRAFT) result —
    // matches "results entered, not yet published."
  }
  console.log("Entered (unpublished) IT marks for 3 students — demonstrates draft/in-progress state.");

  // ---------------------------------------------------------------------
  // Attendance — Class 9 A-D, 10 school days, realistic mixed statuses,
  // plus one corrected record (AttendanceAudit demonstration).
  // ---------------------------------------------------------------------
  const attendanceDates = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
  const sectionByStudentId = new Map<string, { schoolGradeId: string; sectionId: string | null }>();
  for (const sec of sectionPlan) {
    // handled below per-student via GradeHistory lookup for correctness
  }
  const c9History = await prisma.gradeHistory.findMany({ where: { schoolGradeId: class9.id, academicSessionId: activeSession.id } });
  for (const h of c9History) sectionByStudentId.set(h.studentId, { schoolGradeId: h.schoolGradeId, sectionId: h.sectionId });

  let attendanceCount = 0;
  for (const dateStr of attendanceDates) {
    const date = new Date(dateStr);
    for (const s of c9Students) {
      const place = sectionByStudentId.get(s.student.id);
      if (!place) continue;
      const r = rng();
      const status = r < 0.86 ? "PRESENT" : r < 0.93 ? "ABSENT" : r < 0.98 ? "LATE" : "EXCUSED";
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: s.student.id, date } },
        update: {},
        create: {
          studentId: s.student.id,
          academicSessionId: activeSession.id,
          schoolGradeId: place.schoolGradeId,
          sectionId: place.sectionId,
          date,
          status,
          markedByUserId: demoTeacherUser.id,
        },
      });
      attendanceCount++;
    }
  }
  console.log(`Attendance seeded: ${attendanceCount} records across ${attendanceDates.length} school days for Class 9 A-D.`);

  // One correction: the first student's first attendance day, producing a
  // real AttendanceAudit row. Deterministic regardless of what the random
  // roll happened to assign that day (flips PRESENT<->LATE either way), and
  // idempotent (checks for the audit's own stable id before reapplying).
  const correctionTarget = c9Students[0];
  const correctionDate = new Date(attendanceDates[0]);
  const existingAttendance = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId: correctionTarget.student.id, date: correctionDate } },
  });
  if (existingAttendance) {
    const auditId = `att-audit-${existingAttendance.id}`;
    const alreadyCorrected = await prisma.attendanceAudit.findUnique({ where: { id: auditId } });
    if (!alreadyCorrected) {
      const newStatus = existingAttendance.status === "PRESENT" ? "LATE" : "PRESENT";
      const newRemarks =
        newStatus === "PRESENT"
          ? "Correction: student was present, marked in error."
          : "Correction: student arrived after roll call, updated from Present to Late.";
      await prisma.attendanceAudit.create({
        data: {
          id: auditId,
          attendanceId: existingAttendance.id,
          changedByUserId: demoTeacherUser.id,
          previousStatus: existingAttendance.status,
          newStatus,
          previousRemarks: existingAttendance.remarks,
          newRemarks,
        },
      });
      await prisma.attendance.update({ where: { id: existingAttendance.id }, data: { status: newStatus, remarks: newRemarks } });
      console.log(`Corrected one attendance record for ${correctionTarget.user.name} — AttendanceAudit demonstrated.`);
    }
  }

  // Light attendance for Class 6 (5 days).
  const c6History = await prisma.gradeHistory.findMany({ where: { schoolGradeId: class6.id, academicSessionId: activeSession.id } });
  const c6Place = new Map<string, { schoolGradeId: string; sectionId: string | null }>();
  for (const h of c6History) c6Place.set(h.studentId, { schoolGradeId: h.schoolGradeId, sectionId: h.sectionId });
  for (const dateStr of attendanceDates.slice(0, 5)) {
    const date = new Date(dateStr);
    for (const s of c6Students) {
      const place = c6Place.get(s.student.id);
      if (!place) continue;
      const r = rng();
      const status = r < 0.9 ? "PRESENT" : r < 0.97 ? "ABSENT" : "LATE";
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: s.student.id, date } },
        update: {},
        create: {
          studentId: s.student.id,
          academicSessionId: activeSession.id,
          schoolGradeId: place.schoolGradeId,
          sectionId: place.sectionId,
          date,
          status,
          markedByUserId: maya.user.id,
        },
      });
    }
  }
  console.log("Attendance seeded: 5 school days for Class 6 A/B.");

  // ---------------------------------------------------------------------
  // Evaluations — General (Demo Teacher) + Subject (Bimla, Mathematics),
  // spanning the full visibility-gate range.
  // ---------------------------------------------------------------------
  async function ensureGeneralEvaluation(
    student: NewStudent,
    remarks: string,
    visibleToParent: boolean,
    visibleToStudent: boolean
  ) {
    const place = sectionByStudentId.get(student.student.id)!;
    // General evaluations have gradeSubjectId: null, which (same
    // NULL-in-unique-index limitation as elsewhere) the compound-unique
    // upsert shortcut can't express — findFirst + create instead.
    const existing = await prisma.studentEvaluation.findFirst({
      where: { studentId: student.student.id, teacherId: demoTeacher.id, academicSessionId: activeSession.id, gradeSubjectId: null },
    });
    if (existing) return existing;
    return prisma.studentEvaluation.create({
      data: {
        studentId: student.student.id,
        teacherId: demoTeacher.id,
        academicSessionId: activeSession.id,
        schoolGradeId: class9.id,
        sectionId: place.sectionId,
        gradeSubjectId: null,
        remarks,
        visibleToParent,
        sharedWithParentAt: visibleToParent ? new Date("2026-08-26") : null,
        visibleToStudent,
        sharedWithStudentAt: visibleToStudent ? new Date("2026-08-26") : null,
        createdByUserId: demoTeacherUser.id,
      },
    });
  }

  const evalStudents = c9Students.slice(0, 5);
  await ensureGeneralEvaluation(evalStudents[0], "Consistently attentive in class and helps classmates during group work. Keep up the good habits.", false, false);
  await ensureGeneralEvaluation(evalStudents[1], "Shows strong improvement in punctuality this term. Encourage more participation in class discussions.", false, true);
  await ensureGeneralEvaluation(evalStudents[2], "Very cooperative and respectful. Needs to focus more during independent study periods.", true, false);
  const sharedBoth = await ensureGeneralEvaluation(evalStudents[3], "A dependable, hardworking student. Continues to set a good example for peers in Section.", true, true);
  await ensureGeneralEvaluation(evalStudents[4], "Settling in well this term. A bit shy in group activities but engaged one-on-one.", true, true);

  // Demonstrate a post-share correction (StudentEvaluationAudit).
  if (sharedBoth.visibleToParent || sharedBoth.visibleToStudent) {
    const newRemarks =
      "A dependable, hardworking student. Continues to set a good example for peers in Section, and has taken on a helpful role assisting newer classmates.";
    await prisma.studentEvaluationAudit.upsert({
      where: { id: `se-audit-${sharedBoth.id}` },
      update: {},
      create: {
        id: `se-audit-${sharedBoth.id}`,
        evaluationId: sharedBoth.id,
        changedByUserId: demoTeacherUser.id,
        previousRemarks: sharedBoth.remarks,
        newRemarks,
      },
    });
    await prisma.studentEvaluation.update({ where: { id: sharedBoth.id }, data: { remarks: newRemarks } });
    console.log("Demonstrated a post-share evaluation correction (StudentEvaluationAudit).");
  }

  async function ensureSubjectEvaluation(student: NewStudent, remarks: string, visibleToParent: boolean, visibleToStudent: boolean) {
    const place = sectionByStudentId.get(student.student.id)!;
    return prisma.studentEvaluation.upsert({
      where: {
        studentId_teacherId_academicSessionId_gradeSubjectId: {
          studentId: student.student.id,
          teacherId: bimla.id,
          academicSessionId: activeSession.id,
          gradeSubjectId: gradeSubjectsC9["Mathematics"].id,
        },
      },
      update: {},
      create: {
        studentId: student.student.id,
        teacherId: bimla.id,
        academicSessionId: activeSession.id,
        schoolGradeId: class9.id,
        sectionId: place.sectionId,
        gradeSubjectId: gradeSubjectsC9["Mathematics"].id,
        remarks,
        visibleToParent,
        sharedWithParentAt: visibleToParent ? new Date("2026-08-27") : null,
        visibleToStudent,
        sharedWithStudentAt: visibleToStudent ? new Date("2026-08-27") : null,
        createdByUserId: bimlaUser.id,
      },
    });
  }
  const mathEvalStudents = c9Students.filter((s) => {
    const p = sectionByStudentId.get(s.student.id);
    return p && (p.sectionId === sectionsC9["A"].id || p.sectionId === sectionsC9["B"].id);
  }).slice(0, 4);
  await ensureSubjectEvaluation(mathEvalStudents[0], "Strong grasp of algebraic concepts; consistently completes homework accurately.", false, true);
  await ensureSubjectEvaluation(mathEvalStudents[1], "Needs more practice with word problems, but shows real effort in class.", true, false);
  const linkedEval = await ensureSubjectEvaluation(mathEvalStudents[2], "Excellent problem-solving speed; encourage taking on peer-tutoring for classmates.", true, true);
  await ensureSubjectEvaluation(mathEvalStudents[3], "Working privately with this student on foundational multiplication fluency.", false, false);

  console.log(`Evaluations seeded: ${5 + 4} total (General + Subject), spanning private/shared-student/shared-parent/shared-both.`);

  // ---------------------------------------------------------------------
  // Unit Test — one new Mathematics chapter/unit + quiz for Section A.
  // ---------------------------------------------------------------------
  const existingPlan = await prisma.teachingPlan.findFirst({ where: { gradeSubjectId: gradeSubjectsC9["Mathematics"].id, sectionId: null } });
  const teachingPlan =
    existingPlan ??
    (await prisma.teachingPlan.create({
      data: {
        gradeSubjectId: gradeSubjectsC9["Mathematics"].id,
        academicSessionId: activeSession.id,
        schoolGradeId: class9.id,
        sectionId: null,
        subjectId: subjects["Mathematics"].id,
        plannedTotal: 12,
        unitLabel: "Chapter",
        createdByUserId: bimlaUser.id,
      },
    }));
  let unit = await prisma.teachingUnit.findFirst({
    where: { gradeSubjectId: gradeSubjectsC9["Mathematics"].id, sectionId: null, title: "Chapter 5: Algebra Basics" },
  });
  if (!unit) {
    unit = await prisma.teachingUnit.create({
      data: {
        gradeSubjectId: gradeSubjectsC9["Mathematics"].id,
        academicSessionId: activeSession.id,
        schoolGradeId: class9.id,
        sectionId: null,
        subjectId: subjects["Mathematics"].id,
        title: "Chapter 5: Algebra Basics",
        order: 5,
        status: "IN_PROGRESS",
        startedAt: new Date("2026-08-10"),
        createdByUserId: bimlaUser.id,
      },
    });
  }
  let unitTest = await prisma.unitTest.findFirst({ where: { unitId: unit.id, title: "Algebra Basics Quiz" } });
  if (!unitTest) {
    unitTest = await prisma.unitTest.create({
      data: { unitId: unit.id, title: "Algebra Basics Quiz", testDate: new Date("2026-08-21"), maxMarks: 20, createdByUserId: bimlaUser.id },
    });
  }
  const sectionAStudents = c9Students.filter((s) => sectionByStudentId.get(s.student.id)?.sectionId === sectionsC9["A"].id);
  for (let i = 0; i < sectionAStudents.length; i++) {
    const s = sectionAStudents[i];
    const isAbsent = i === sectionAStudents.length - 1;
    await prisma.unitTestResult.upsert({
      where: { unitTestId_studentId: { unitTestId: unitTest.id, studentId: s.student.id } },
      update: {},
      create: {
        unitTestId: unitTest.id,
        studentId: s.student.id,
        status: isAbsent ? "ABSENT" : "EVALUATED",
        marksObtained: isAbsent ? null : markFor(20, s.ability.math),
        evaluatedByUserId: bimlaUser.id,
        evaluatedAt: new Date("2026-08-21"),
      },
    });
  }
  console.log(`Unit test "Algebra Basics Quiz" evaluated for ${sectionAStudents.length} Section A students.`);

  // ---------------------------------------------------------------------
  // Parent-Teacher Meetings — 3 more, spanning SCHEDULED/COMPLETED/CANCELLED.
  // ---------------------------------------------------------------------
  await prisma.parentTeacherMeeting.upsert({
    where: { id: "ptm-demo-completed-1" },
    update: {},
    create: {
      id: "ptm-demo-completed-1",
      schoolId: sunrise.id,
      academicSessionId: activeSession.id,
      studentId: mathEvalStudents[2].student.id,
      teacherId: bimla.id,
      gradeSubjectId: gradeSubjectsC9["Mathematics"].id,
      scheduledAt: new Date("2026-08-15T09:00:00Z"),
      location: "Room 12",
      status: "COMPLETED",
      outcomeNotes: "Discussed strong progress in algebra; parent agreed to encourage peer-tutoring involvement at home.",
      linkedEvaluationId: linkedEval.id,
      createdByUserId: bimlaUser.id,
    },
  });
  await prisma.parentTeacherMeeting.upsert({
    where: { id: "ptm-demo-cancelled-1" },
    update: {},
    create: {
      id: "ptm-demo-cancelled-1",
      schoolId: sunrise.id,
      academicSessionId: activeSession.id,
      studentId: evalStudents[1].student.id,
      teacherId: demoTeacher.id,
      scheduledAt: new Date("2026-08-19T10:00:00Z"),
      status: "CANCELLED",
      createdByUserId: demoTeacherUser.id,
    },
  });
  await prisma.parentTeacherMeeting.upsert({
    where: { id: "ptm-demo-scheduled-1" },
    update: {},
    create: {
      id: "ptm-demo-scheduled-1",
      schoolId: sunrise.id,
      academicSessionId: activeSession.id,
      studentId: evalStudents[4].student.id,
      teacherId: anita.teacher.id,
      gradeSubjectId: gradeSubjectsC9["English"].id,
      scheduledAt: new Date("2026-09-10T09:30:00Z"),
      location: "Room 8",
      status: "SCHEDULED",
      createdByUserId: anita.user.id,
    },
  });
  console.log("Parent-Teacher Meetings seeded: 1 completed (with linked evaluation), 1 cancelled, 1 scheduled.");

  // ---------------------------------------------------------------------
  // Parents — linked to a well-chosen cross-section of students.
  // ---------------------------------------------------------------------
  async function ensureParentFor(student: NewStudent, label: string) {
    const n = personName(rng() < 0.5 ? "M" : "F");
    const email = emailFor(n.first, n.last);
    const u = await upsertUser(email, `${n.full} (Parent)`, "PARENT");
    const p = await prisma.parent.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: p.id, studentId: student.student.id } },
      update: {},
      create: { parentId: p.id, studentId: student.student.id },
    });
    console.log(`  Parent linked (${label}): ${email} -> ${student.user.name}`);
    return { user: u, parent: p };
  }

  const repeatedStudentRecord = c9Students.find((s) => sectionByStudentId.get(s.student.id)?.sectionId === sectionsC9["B"].id) ?? c9Students[0];
  console.log("Creating parent accounts:");
  await ensureParentFor(c9Students[8], "newly enrolled student");
  await ensureParentFor(c9Students[16], "newly enrolled student");
  await ensureParentFor(c9Students[0], "high-performing published results");
  await ensureParentFor(c9Students[10], "average/struggling published results");
  await ensureParentFor(evalStudents[3], "student with a shared evaluation");
  await ensureParentFor(c6Students[0], "Class 6 student (outside the flagship grade)");

  // ---------------------------------------------------------------------
  // Skills / Interests — a few more, teacher-credited.
  // ---------------------------------------------------------------------
  async function ensureSkill(student: NewStudent, addedByUserId: string, name: string) {
    await prisma.skill.upsert({
      where: { studentId_addedByUserId_name: { studentId: student.student.id, addedByUserId, name } },
      update: {},
      create: { studentId: student.student.id, addedByUserId, name },
    });
  }
  await ensureSkill(mathEvalStudents[0], bimlaUser.id, "Problem Solving");
  await ensureSkill(evalStudents[0], demoTeacherUser.id, "Teamwork");
  await ensureSkill(evalStudents[3], demoTeacherUser.id, "Leadership");
  await ensureSkill(sectionAStudents[0] ?? c9Students[0], bimlaUser.id, "Public Speaking");

  async function ensureInterest(user: any, name: string) {
    await prisma.interest.upsert({ where: { userId_name: { userId: user.id, name } }, update: {}, create: { userId: user.id, name } });
  }
  await ensureInterest(c9Students[1].user, "Basketball");
  await ensureInterest(c9Students[2].user, "Reading");
  await ensureInterest(c6Students[0].user, "Drawing");

  console.log("Skills and interests seeded.");

  // ---------------------------------------------------------------------
  // Courses — Demo Student's original completion + certificate on the
  // seed.ts-created "Intro to CBE" course was manual test data, not
  // reproducible by any script; recreated here for self-sufficiency. Then a
  // second published course ("Hand Writing," also not in seed.ts's own
  // baseline) with a couple more students: one completed (2nd certificate
  // example), one left in progress.
  // ---------------------------------------------------------------------
  const cbeCourse = await prisma.course.findUnique({ where: { slug: "intro-to-cbe" } });
  if (cbeCourse) {
    let cbeEnrollment = await prisma.courseEnrollment.findFirst({ where: { courseId: cbeCourse.id, studentId: demoStudent.id } });
    if (!cbeEnrollment) {
      cbeEnrollment = await prisma.courseEnrollment.create({
        data: { courseId: cbeCourse.id, studentId: demoStudent.id, progress: 100, completedAt: new Date("2026-08-10") },
      });
    }
    const existingCbeCert = await prisma.certificate.findUnique({ where: { enrollmentId: cbeEnrollment.id } });
    if (!existingCbeCert) {
      const cbeOrg = await prisma.organization.findUnique({ where: { id: cbeCourse.organizationId ?? undefined } });
      await prisma.certificate.create({
        data: {
          recipientUserId: demoStudentUser.id,
          enrollmentId: cbeEnrollment.id,
          issuerType: "ORGANIZATION",
          issuerOrganizationId: cbeCourse.organizationId,
          title: cbeCourse.title,
          recipientNameSnapshot: demoStudentUser.name,
          recipientMegaIdSnapshot: demoStudentUser.id,
          issuerNameSnapshot: cbeOrg?.name ?? "MEGA Academy Labs",
        },
      });
      console.log(`Course completed + certificate issued: ${demoStudentUser.name} -> "${cbeCourse.title}".`);
    }
  }

  const megaAcademyLabs = await prisma.organization.findUnique({ where: { slug: "mega-academy-labs" } });
  let handwritingCourse = await prisma.course.findUnique({ where: { slug: "hand-writing" } });
  if (!handwritingCourse && megaAcademyLabs) {
    handwritingCourse = await prisma.course.create({
      data: {
        organizationId: megaAcademyLabs.id,
        title: "Hand Writing",
        slug: "hand-writing",
        description: "A short demo course on cursive handwriting fundamentals.",
        priceCents: 0,
        published: true,
        modules: {
          create: [
            {
              title: "Cursive Writing",
              order: 0,
              lessons: {
                create: [
                  { title: "Letter Formation Basics", content: "Demo lesson content on forming cursive letters.", order: 0 },
                  { title: "Joining Letters", content: "Demo lesson content on connecting cursive letters into words.", order: 1 },
                ],
              },
            },
          ],
        },
      },
    });
    console.log('Created course "Hand Writing" (was not part of the baseline seed).');
  }
  if (handwritingCourse) {
    const enrollee1 = c9Students[5];
    const enrollee2 = c9Students[6];

    let enrollment1 = await prisma.courseEnrollment.findFirst({ where: { courseId: handwritingCourse.id, studentId: enrollee1.student.id } });
    if (!enrollment1) {
      enrollment1 = await prisma.courseEnrollment.create({
        data: { courseId: handwritingCourse.id, studentId: enrollee1.student.id, progress: 100, completedAt: new Date("2026-08-20") },
      });
    }
    const existingCert = await prisma.certificate.findUnique({ where: { enrollmentId: enrollment1.id } });
    if (!existingCert) {
      await prisma.certificate.create({
        data: {
          recipientUserId: enrollee1.user.id,
          enrollmentId: enrollment1.id,
          issuerType: "ORGANIZATION",
          issuerOrganizationId: handwritingCourse.organizationId,
          title: handwritingCourse.title,
          recipientNameSnapshot: enrollee1.user.name,
          recipientMegaIdSnapshot: enrollee1.user.id,
          issuerNameSnapshot: "MEGA Academy Labs",
        },
      });
      console.log(`Course completed + certificate issued: ${enrollee1.user.name} -> "${handwritingCourse.title}".`);
    }

    const enrollment2 = await prisma.courseEnrollment.findFirst({ where: { courseId: handwritingCourse.id, studentId: enrollee2.student.id } });
    if (!enrollment2) {
      await prisma.courseEnrollment.create({ data: { courseId: handwritingCourse.id, studentId: enrollee2.student.id, progress: 50 } });
      console.log(`Course in progress: ${enrollee2.user.name} -> "${handwritingCourse.title}" (50%).`);
    }
  }

  // =========================================================================
  // HIMALAYAN SECONDARY SCHOOL — a second, independent, smaller-setup
  // school, demonstrating multi-school data isolation.
  // =========================================================================
  const himalayan = await prisma.school.upsert({
    where: { slug: "himalayan-secondary-school" },
    update: {},
    create: {
      name: "Himalayan Secondary School",
      slug: "himalayan-secondary-school",
      location: "Pokhara",
      gradesOffered: "8",
      description: "A newer, smaller demo school — recently joined MEGA.EDU — showing that each school's data is fully independent.",
      verified: true,
      contactEmail: "info@himalayansecondary.demo",
    },
  });

  const himalayanAdminUser = await upsertUser("admin.himalayan@megaedu.local", "Himalayan School Admin", "SCHOOL_ADMIN");
  await prisma.schoolAdmin.upsert({
    where: { userId_schoolId: { userId: himalayanAdminUser.id, schoolId: himalayan.id } },
    update: {},
    create: { userId: himalayanAdminUser.id, schoolId: himalayan.id },
  });

  const himalayanSession = await ensureSession(
    himalayan.id,
    { status: "ACTIVE" },
    { name: "2026-2027", startDate: "2026-04-15", endDate: "2027-04-14", status: "ACTIVE" }
  );

  const himClass8 = await prisma.schoolGrade.upsert({
    where: { schoolId_gradeReferenceId: { schoolId: himalayan.id, gradeReferenceId: gY8.id } },
    update: {},
    create: { schoolId: himalayan.id, gradeReferenceId: gY8.id, displayName: "Class 8" },
  });
  const himSections: Record<string, { id: string }> = {};
  for (const name of ["A", "B"]) {
    himSections[name] = await prisma.section.upsert({
      where: { schoolGradeId_name: { schoolGradeId: himClass8.id, name } },
      update: {},
      create: { schoolGradeId: himClass8.id, name },
    });
  }

  const himSubjectNames = ["Mathematics", "English", "Science"];
  const himSubjects: Record<string, { id: string }> = {};
  for (const name of himSubjectNames) {
    himSubjects[name] = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: himalayan.id, name } },
      update: {},
      create: { schoolId: himalayan.id, name },
    });
  }
  const himGradeSubjects: Record<string, { id: string }> = {};
  for (const name of himSubjectNames) {
    himGradeSubjects[name] = await prisma.gradeSubject.upsert({
      where: { schoolGradeId_subjectId_academicSessionId: { schoolGradeId: himClass8.id, subjectId: himSubjects[name].id, academicSessionId: himalayanSession.id } },
      update: {},
      create: { schoolGradeId: himClass8.id, subjectId: himSubjects[name].id, academicSessionId: himalayanSession.id },
    });
  }

  const kiranUser = await upsertUser("kiran.basnet.him@megaedu.local", "Kiran Basnet", "TEACHER");
  const kiran = await prisma.teacher.upsert({
    where: { userId: kiranUser.id },
    update: {},
    create: { userId: kiranUser.id, schoolId: himalayan.id, approved: true, position: "Mathematics & Science Teacher" },
  });
  const sunitaUser = await upsertUser("sunita.karki.him@megaedu.local", "Sunita Karki", "TEACHER");
  const sunita = await prisma.teacher.upsert({
    where: { userId: sunitaUser.id },
    update: {},
    create: { userId: sunitaUser.id, schoolId: himalayan.id, approved: true, position: "English Teacher" },
  });

  await prisma.teacherGradeAssignment.upsert({
    where: { teacherId_schoolGradeId_academicSessionId: { teacherId: kiran.id, schoolGradeId: himClass8.id, academicSessionId: himalayanSession.id } },
    update: {},
    create: { teacherId: kiran.id, schoolGradeId: himClass8.id, academicSessionId: himalayanSession.id },
  });
  await prisma.teacherGradeAssignment.upsert({
    where: { teacherId_schoolGradeId_academicSessionId: { teacherId: sunita.id, schoolGradeId: himClass8.id, academicSessionId: himalayanSession.id } },
    update: {},
    create: { teacherId: sunita.id, schoolGradeId: himClass8.id, academicSessionId: himalayanSession.id },
  });

  async function ensureHimTAA(teacherId: string, subjectName: string) {
    const existing = await prisma.teacherAcademicAssignment.findFirst({
      where: { teacherId, academicSessionId: himalayanSession.id, schoolGradeId: himClass8.id, sectionId: null, subjectId: himSubjects[subjectName].id },
    });
    if (existing) return existing;
    return prisma.teacherAcademicAssignment.create({
      data: {
        teacherId,
        academicSessionId: himalayanSession.id,
        schoolGradeId: himClass8.id,
        sectionId: null,
        subjectId: himSubjects[subjectName].id,
        gradeSubjectId: himGradeSubjects[subjectName].id,
      },
    });
  }
  await ensureHimTAA(kiran.id, "Mathematics");
  await ensureHimTAA(kiran.id, "Science");
  await ensureHimTAA(sunita.id, "English");

  const existingHimCTA = await prisma.classTeacherAssignment.findFirst({
    where: { schoolGradeId: himClass8.id, sectionId: null, academicSessionId: himalayanSession.id },
  });
  if (!existingHimCTA) {
    await prisma.classTeacherAssignment.create({
      data: { teacherId: kiran.id, schoolGradeId: himClass8.id, sectionId: null, academicSessionId: himalayanSession.id },
    });
  }

  const himStudents: NewStudent[] = [];
  for (const sec of [{ name: "A", count: 7 }, { name: "B", count: 6 }]) {
    for (let i = 0; i < sec.count; i++) {
      const gender = rng() < 0.5 ? "M" : "F";
      const n = personName(gender);
      const email = emailFor(n.first, n.last);
      const u = await upsertUser(email, n.full, "STUDENT");
      const st = await prisma.student.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, schoolId: himalayan.id, approved: true } });
      himStudents.push({ user: u, student: st, gender, ability: { math: 0.5, science: 0.5 } });
      await prisma.gradeHistory.upsert({
        where: { studentId_academicSessionId: { studentId: st.id, academicSessionId: himalayanSession.id } },
        update: {},
        create: { studentId: st.id, schoolGradeId: himClass8.id, sectionId: himSections[sec.name].id, academicSessionId: himalayanSession.id, status: "ENROLLED" },
      });
    }
  }
  console.log(`Himalayan Secondary School roster ready: ${himStudents.length} Class 8 students across sections A/B.`);

  // Light attendance — 5 school days.
  for (const dateStr of attendanceDates.slice(0, 5)) {
    const date = new Date(dateStr);
    for (let i = 0; i < himStudents.length; i++) {
      const s = himStudents[i];
      const sec = i < 7 ? "A" : "B";
      const r = rng();
      const status = r < 0.88 ? "PRESENT" : r < 0.96 ? "ABSENT" : "LATE";
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: s.student.id, date } },
        update: {},
        create: {
          studentId: s.student.id,
          academicSessionId: himalayanSession.id,
          schoolGradeId: himClass8.id,
          sectionId: himSections[sec].id,
          date,
          status,
          markedByUserId: kiranUser.id,
        },
      });
    }
  }
  console.log("Himalayan attendance seeded: 5 school days.");

  // One parent, linked only at Himalayan — demonstrates isolation from Sunrise.
  const himParentUserSeed = personName("F");
  const himParentEmail = emailFor(himParentUserSeed.first, himParentUserSeed.last);
  const himParentUser = await upsertUser(himParentEmail, `${himParentUserSeed.full} (Parent)`, "PARENT");
  const himParent = await prisma.parent.upsert({ where: { userId: himParentUser.id }, update: {}, create: { userId: himParentUser.id } });
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: himParent.id, studentId: himStudents[0].student.id } },
    update: {},
    create: { parentId: himParent.id, studentId: himStudents[0].student.id },
  });
  console.log(`Himalayan parent: ${himParentEmail} -> ${himStudents[0].user.name}`);

  console.log("\nDemo data seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
