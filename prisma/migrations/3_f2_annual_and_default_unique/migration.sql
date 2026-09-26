-- Hand-written, reviewed migration (finding F2, rules A6 and A5; approved 2026-09-26 as two
-- explicit exceptions to decision D7, which otherwise keeps NULL-distinct unique keys).
-- Prisma 5.20 cannot express partial unique indexes in schema.prisma, so Prisma's diffs
-- propose dropping these two; the migrations workflow tolerates exactly those DROP INDEX
-- statements, as it does for the indexes in 1_ and 2_.

-- F2/A6: at most one annual co-scholastic grade (coScholasticPeriodId NULL) per student,
-- area and academic session. Period grades are not affected; the model's
-- @@unique([studentId, areaId, coScholasticPeriodId]) already keeps them unique.
CREATE UNIQUE INDEX "CoScholasticResult_one_annual_per_student_area_session" ON "CoScholasticResult"("studentId", "areaId", "academicSessionId") WHERE "coScholasticPeriodId" IS NULL;

-- F2/A5: at most one grade-default assessment framework (gradeSubjectId NULL) per academic
-- session and grade. Subject overrides are not affected; the model's
-- @@unique([academicSessionId, schoolGradeId, gradeSubjectId]) already keeps them unique.
CREATE UNIQUE INDEX "AssessmentFrameworkAssignment_one_default_per_grade_session" ON "AssessmentFrameworkAssignment"("academicSessionId", "schoolGradeId") WHERE "gradeSubjectId" IS NULL;
