-- DropForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" DROP CONSTRAINT "AssessmentFrameworkAssignment_gradeSubjectId_fkey";

-- DropForeignKey
ALTER TABLE "Homework" DROP CONSTRAINT "Homework_gradeSubjectId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherMeeting" DROP CONSTRAINT "ParentTeacherMeeting_gradeSubjectId_fkey";

-- DropForeignKey
ALTER TABLE "StudentEvaluation" DROP CONSTRAINT "StudentEvaluation_gradeSubjectId_fkey";

-- DropForeignKey
ALTER TABLE "TeachingPlan" DROP CONSTRAINT "TeachingPlan_gradeSubjectId_fkey";

-- DropForeignKey
ALTER TABLE "TeachingUnit" DROP CONSTRAINT "TeachingUnit_gradeSubjectId_fkey";

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

