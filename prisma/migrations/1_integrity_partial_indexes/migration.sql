-- Hand-written, reviewed migration (database-foundation decisions D8.2, D8.3).
-- Prisma 5.20 cannot express partial unique indexes in schema.prisma, so
-- Prisma's diffs propose dropping these two; the migrations workflow
-- tolerates exactly those two DROP INDEX statements and nothing else.
-- Every migration generated after this one must be reviewed to make sure it
-- does not drop them.

-- D8.2: at most one ACTIVE academic session per school.
CREATE UNIQUE INDEX "AcademicSession_one_active_per_school" ON "AcademicSession"("schoolId") WHERE "status" = 'ACTIVE';

-- D8.3: at most one open (ACTIVE or PENDING) affiliation per student, at any school.
CREATE UNIQUE INDEX "StudentSchoolAffiliation_one_open_per_student" ON "StudentSchoolAffiliation"("studentId") WHERE "status" IN ('ACTIVE', 'PENDING');
