-- Hand-written, reviewed migration (finding F1; approved 2026-09-25 as an explicit
-- exception to decision D7, which otherwise keeps NULL-distinct unique keys).
-- Prisma 5.20 cannot express partial unique indexes in schema.prisma, so
-- Prisma's diffs propose dropping this index; the migrations workflow
-- tolerates that one DROP INDEX statement, as it does for the two indexes in
-- 1_integrity_partial_indexes.

-- F1: at most one grade-wide ClassTeacherAssignment (sectionId NULL, the Grade
-- Coordinator) per grade per academic session. Section-specific rows (Class
-- Teachers) are not affected; @@unique([schoolGradeId, sectionId,
-- academicSessionId]) already keeps them unique.
CREATE UNIQUE INDEX "ClassTeacherAssignment_one_grade_wide_per_session" ON "ClassTeacherAssignment"("schoolGradeId", "academicSessionId") WHERE "sectionId" IS NULL;
