-- Hand-written, reviewed migration (finding F2, rules A1-A4; approved 2026-09-26 as four explicit
-- exceptions to decision D7, which otherwise keeps NULL-distinct unique keys). Prisma 5.20 cannot
-- express partial unique indexes in schema.prisma, so Prisma's diffs propose dropping these four;
-- the migrations workflow tolerates exactly those DROP INDEX statements, as it does for 1_ to 3_.

-- F2/A1 (first half): at most one grade-wide subject assignment (sectionId NULL) per teacher,
-- session, grade and subject. The overlap half of A1 (no grade-wide row together with section
-- rows) cannot be expressed as an index; the assignment route enforces it in a SERIALIZABLE
-- transaction.
CREATE UNIQUE INDEX "TeacherAcademicAssignment_one_grade_wide_per_teacher_subject" ON "TeacherAcademicAssignment"("teacherId", "academicSessionId", "schoolGradeId", "subjectId") WHERE "sectionId" IS NULL;

-- F2/A2: at most one grade-wide teaching plan (sectionId NULL) per grade subject.
CREATE UNIQUE INDEX "TeachingPlan_one_grade_wide_per_grade_subject" ON "TeachingPlan"("gradeSubjectId") WHERE "sectionId" IS NULL;

-- F2/A3: at most one general evaluation (gradeSubjectId NULL) per student, teacher and session.
CREATE UNIQUE INDEX "StudentEvaluation_one_general_per_student_teacher_session" ON "StudentEvaluation"("studentId", "teacherId", "academicSessionId") WHERE "gradeSubjectId" IS NULL;

-- F2/A4: framework-level components (periodId NULL) have unique names within a framework.
CREATE UNIQUE INDEX "AssessmentComponent_unique_name_framework_level" ON "AssessmentComponent"("frameworkId", "name") WHERE "periodId" IS NULL;
