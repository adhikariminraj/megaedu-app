-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "location" TEXT,
    "district" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "gradesOffered" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolAccountant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolAccountant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "userId" TEXT,
    "schoolId" TEXT,
    "bio" TEXT,
    "subjects" TEXT,
    "position" TEXT NOT NULL DEFAULT 'Teacher',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "userId" TEXT,
    "schoolId" TEXT,
    "gradeLevel" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interestsLockedForSessionId" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudent" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSchoolAffiliation" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "startDateSource" TEXT NOT NULL DEFAULT 'RECORDED',
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "position" TEXT NOT NULL DEFAULT 'Teacher',
    "subjects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSchoolAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSchoolAffiliation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "startDateSource" TEXT NOT NULL DEFAULT 'RECORDED',
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "admissionNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSchoolAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeReference" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GradeReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolGrade" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gradeReferenceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "SchoolGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherGradeAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,

    CONSTRAINT "TeacherGradeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "academicSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "outcomeGradeId" TEXT,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistoryAudit" (
    "id" TEXT NOT NULL,
    "gradeHistoryId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT NOT NULL,
    "previousOutcomeGradeId" TEXT,
    "previousSectionId" TEXT,
    "newStatus" TEXT NOT NULL,
    "newOutcomeGradeId" TEXT,
    "newSectionId" TEXT,

    CONSTRAINT "GradeHistoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeSubject" (
    "id" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAcademicAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAcademicAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTeacherAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "markedByUserId" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAudit" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "previousRemarks" TEXT,
    "newRemarks" TEXT,

    CONSTRAINT "AttendanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingPlan" (
    "id" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "plannedTotal" INTEGER NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'Unit',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingUnit" (
    "id" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitTest" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitTestResult" (
    "id" TEXT NOT NULL,
    "unitTestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "marksObtained" DOUBLE PRECISION,
    "remarks" TEXT,
    "evaluatedByUserId" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "UnitTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "gradeSubjectId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "targetStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkApplicability" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkCompletion" (
    "id" TEXT NOT NULL,
    "homeworkApplicabilityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedByTeacherId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkCompletionAudit" (
    "id" TEXT NOT NULL,
    "homeworkCompletionId" TEXT NOT NULL,
    "changedByTeacherId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,

    CONSTRAINT "HomeworkCompletionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmissionAttempt" (
    "id" TEXT NOT NULL,
    "homeworkApplicabilityId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "isLate" BOOLEAN NOT NULL,
    "textContent" TEXT,
    "filePath" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkReview" (
    "id" TEXT NOT NULL,
    "homeworkApplicabilityId" TEXT NOT NULL,
    "submissionAttemptId" TEXT,
    "reviewNumber" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "reviewedByTeacherId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEvaluation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "sectionId" TEXT,
    "gradeSubjectId" TEXT,
    "remarks" TEXT NOT NULL,
    "visibleToParent" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithParentAt" TIMESTAMP(3),
    "visibleToStudent" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithStudentAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEvaluationAudit" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousRemarks" TEXT NOT NULL,
    "newRemarks" TEXT NOT NULL,

    CONSTRAINT "StudentEvaluationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentTeacherMeeting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "gradeSubjectId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "onlineUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "outcomeNotes" TEXT,
    "linkedEvaluationId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentTeacherMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentFramework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gradingScaleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPeriod" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentComponent" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "periodId" TEXT,
    "name" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "entryMode" TEXT NOT NULL DEFAULT 'MARKS',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingScale" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingScaleBand" (
    "id" TEXT NOT NULL,
    "gradingScaleId" TEXT NOT NULL,
    "minPercent" DOUBLE PRECISION NOT NULL,
    "maxPercent" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "gradePoint" DOUBLE PRECISION,
    "isPassing" BOOLEAN,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GradingScaleBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentFrameworkAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "gradeSubjectId" TEXT,
    "frameworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentFrameworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentComponentResult" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "marksObtained" DOUBLE PRECISION,
    "gradeLabel" TEXT,
    "remarks" TEXT,
    "evaluatedByUserId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentComponentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentComponentResultAudit" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "previousMarksObtained" DOUBLE PRECISION,
    "newMarksObtained" DOUBLE PRECISION,
    "previousGradeLabel" TEXT,
    "newGradeLabel" TEXT,
    "previousRemarks" TEXT,
    "newRemarks" TEXT,

    CONSTRAINT "AssessmentComponentResultAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResultPublication" (
    "id" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResultPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSheet" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT NOT NULL,
    "issuerNameSnapshot" TEXT NOT NULL,
    "schoolNameSnapshot" TEXT NOT NULL,
    "academicSessionNameSnapshot" TEXT NOT NULL,
    "gradeDisplayNameSnapshot" TEXT NOT NULL,
    "sectionNameSnapshot" TEXT,
    "studentNameSnapshot" TEXT NOT NULL,
    "studentMegaIdSnapshot" TEXT,
    "outcomeStatus" TEXT NOT NULL,
    "outcomeGradeDisplayNameSnapshot" TEXT,
    "gpaSnapshot" DOUBLE PRECISION,
    "correctionReason" TEXT,
    "supersededByMarkSheetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSheetSubject" (
    "id" TEXT NOT NULL,
    "markSheetId" TEXT NOT NULL,
    "gradeSubjectId" TEXT NOT NULL,
    "subjectNameSnapshot" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "maximumMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION,
    "gradeLabel" TEXT,
    "gradePoint" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkSheetSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSheetGradingBandSnapshot" (
    "id" TEXT NOT NULL,
    "markSheetId" TEXT NOT NULL,
    "gradingScaleNameSnapshot" TEXT NOT NULL,
    "minPercent" DOUBLE PRECISION NOT NULL,
    "maxPercent" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "gradePoint" DOUBLE PRECISION,
    "isPassing" BOOLEAN,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkSheetGradingBandSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSheetCoScholasticResult" (
    "id" TEXT NOT NULL,
    "markSheetId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "areaNameSnapshot" TEXT NOT NULL,
    "gradeLabelSnapshot" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkSheetCoScholasticResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticArea" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoScholasticArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticPeriod" (
    "id" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoScholasticPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticGradeSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "schoolGradeId" TEXT NOT NULL,
    "gradingScaleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoScholasticGradeSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "coScholasticPeriodId" TEXT,
    "gradeLabel" TEXT NOT NULL,
    "evaluatedByUserId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoScholasticResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academyParticipant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "OrganizationAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAccountant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "OrganizationAccountant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalApproach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "EducationalApproach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolApproach" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "approachId" TEXT NOT NULL,

    CONSTRAINT "SchoolApproach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "approachId" TEXT,
    "instructorId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teacherId" TEXT,
    "studentId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "gradeHistoryId" TEXT,
    "instructorId" TEXT,
    "issuerType" TEXT NOT NULL,
    "issuerOrganizationId" TEXT,
    "issuerSchoolId" TEXT,
    "associatedSchoolId" TEXT,
    "title" TEXT NOT NULL,
    "recipientNameSnapshot" TEXT NOT NULL,
    "recipientMegaIdSnapshot" TEXT NOT NULL,
    "issuerNameSnapshot" TEXT NOT NULL,
    "associatedSchoolNameSnapshot" TEXT,
    "instructorNameSnapshot" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "megaIdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "subject" TEXT,
    "gradeLevel" TEXT,
    "approachId" TEXT,
    "schoolId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralCalendarEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "bsDateDisplay" TEXT,
    "country" TEXT NOT NULL DEFAULT 'NP',
    "sourceNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneralCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "onlineUrl" TEXT,
    "schoolId" TEXT,
    "organizationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCalendarEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "affectsDayStatus" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "applyUrl" TEXT,
    "schoolId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "schoolId" TEXT,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalLevel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "wardCount" INTEGER NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "LocalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "localLevelId" TEXT NOT NULL,
    "wardNumber" INTEGER NOT NULL,
    "streetAddress" TEXT,
    "houseNumber" TEXT,
    "userId" TEXT,
    "schoolId" TEXT,
    "familyContactId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyContact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "relationshipOther" TEXT,
    "mobileNumber" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isGuardian" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "linkedUserId" TEXT,
    "studentId" TEXT,
    "teacherId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdmin_userId_schoolId_key" ON "SchoolAdmin"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAccountant_userId_schoolId_key" ON "SchoolAccountant"("userId", "schoolId");

-- CreateIndex
CREATE INDEX "Inquiry_schoolId_status_idx" ON "Inquiry"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Inquiry_ipAddress_createdAt_idx" ON "Inquiry"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");

-- CreateIndex
CREATE INDEX "TeacherSchoolAffiliation_teacherId_idx" ON "TeacherSchoolAffiliation"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherSchoolAffiliation_schoolId_idx" ON "TeacherSchoolAffiliation"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherSchoolAffiliation_teacherId_schoolId_idx" ON "TeacherSchoolAffiliation"("teacherId", "schoolId");

-- CreateIndex
CREATE INDEX "StudentSchoolAffiliation_studentId_idx" ON "StudentSchoolAffiliation"("studentId");

-- CreateIndex
CREATE INDEX "StudentSchoolAffiliation_schoolId_idx" ON "StudentSchoolAffiliation"("schoolId");

-- CreateIndex
CREATE INDEX "StudentSchoolAffiliation_studentId_schoolId_idx" ON "StudentSchoolAffiliation"("studentId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSchoolAffiliation_schoolId_admissionNumber_key" ON "StudentSchoolAffiliation"("schoolId", "admissionNumber");

-- CreateIndex
CREATE INDEX "AcademicSession_schoolId_idx" ON "AcademicSession"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeReference_code_key" ON "GradeReference"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GradeReference_order_key" ON "GradeReference"("order");

-- CreateIndex
CREATE INDEX "SchoolGrade_schoolId_idx" ON "SchoolGrade"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolGrade_schoolId_gradeReferenceId_key" ON "SchoolGrade"("schoolId", "gradeReferenceId");

-- CreateIndex
CREATE INDEX "Section_schoolGradeId_idx" ON "Section"("schoolGradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolGradeId_name_key" ON "Section"("schoolGradeId", "name");

-- CreateIndex
CREATE INDEX "TeacherGradeAssignment_academicSessionId_idx" ON "TeacherGradeAssignment"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherGradeAssignment_teacherId_schoolGradeId_academicSess_key" ON "TeacherGradeAssignment"("teacherId", "schoolGradeId", "academicSessionId");

-- CreateIndex
CREATE INDEX "GradeHistory_schoolGradeId_idx" ON "GradeHistory"("schoolGradeId");

-- CreateIndex
CREATE INDEX "GradeHistory_academicSessionId_idx" ON "GradeHistory"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeHistory_studentId_academicSessionId_key" ON "GradeHistory"("studentId", "academicSessionId");

-- CreateIndex
CREATE INDEX "GradeHistoryAudit_gradeHistoryId_idx" ON "GradeHistoryAudit"("gradeHistoryId");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- CreateIndex
CREATE INDEX "GradeSubject_schoolGradeId_idx" ON "GradeSubject"("schoolGradeId");

-- CreateIndex
CREATE INDEX "GradeSubject_academicSessionId_idx" ON "GradeSubject"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeSubject_schoolGradeId_subjectId_academicSessionId_key" ON "GradeSubject"("schoolGradeId", "subjectId", "academicSessionId");

-- CreateIndex
CREATE INDEX "TeacherAcademicAssignment_academicSessionId_idx" ON "TeacherAcademicAssignment"("academicSessionId");

-- CreateIndex
CREATE INDEX "TeacherAcademicAssignment_schoolGradeId_idx" ON "TeacherAcademicAssignment"("schoolGradeId");

-- CreateIndex
CREATE INDEX "TeacherAcademicAssignment_subjectId_idx" ON "TeacherAcademicAssignment"("subjectId");

-- CreateIndex
CREATE INDEX "TeacherAcademicAssignment_teacherId_idx" ON "TeacherAcademicAssignment"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAcademicAssignment_teacherId_academicSessionId_schoo_key" ON "TeacherAcademicAssignment"("teacherId", "academicSessionId", "schoolGradeId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "ClassTeacherAssignment_teacherId_idx" ON "ClassTeacherAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "ClassTeacherAssignment_academicSessionId_idx" ON "ClassTeacherAssignment"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTeacherAssignment_schoolGradeId_sectionId_academicSess_key" ON "ClassTeacherAssignment"("schoolGradeId", "sectionId", "academicSessionId");

-- CreateIndex
CREATE INDEX "Attendance_schoolGradeId_sectionId_date_idx" ON "Attendance"("schoolGradeId", "sectionId", "date");

-- CreateIndex
CREATE INDEX "Attendance_academicSessionId_idx" ON "Attendance"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "AttendanceAudit_attendanceId_idx" ON "AttendanceAudit"("attendanceId");

-- CreateIndex
CREATE INDEX "TeachingPlan_academicSessionId_idx" ON "TeachingPlan"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingPlan_gradeSubjectId_sectionId_key" ON "TeachingPlan"("gradeSubjectId", "sectionId");

-- CreateIndex
CREATE INDEX "TeachingUnit_gradeSubjectId_sectionId_idx" ON "TeachingUnit"("gradeSubjectId", "sectionId");

-- CreateIndex
CREATE INDEX "TeachingUnit_academicSessionId_idx" ON "TeachingUnit"("academicSessionId");

-- CreateIndex
CREATE INDEX "UnitTest_unitId_idx" ON "UnitTest"("unitId");

-- CreateIndex
CREATE INDEX "UnitTestResult_studentId_idx" ON "UnitTestResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitTestResult_unitTestId_studentId_key" ON "UnitTestResult"("unitTestId", "studentId");

-- CreateIndex
CREATE INDEX "Homework_schoolGradeId_dueDate_idx" ON "Homework"("schoolGradeId", "dueDate");

-- CreateIndex
CREATE INDEX "Homework_academicSessionId_idx" ON "Homework"("academicSessionId");

-- CreateIndex
CREATE INDEX "Homework_teacherId_idx" ON "Homework"("teacherId");

-- CreateIndex
CREATE INDEX "HomeworkApplicability_studentId_idx" ON "HomeworkApplicability"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkApplicability_homeworkId_studentId_key" ON "HomeworkApplicability"("homeworkId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkCompletion_homeworkApplicabilityId_key" ON "HomeworkCompletion"("homeworkApplicabilityId");

-- CreateIndex
CREATE INDEX "HomeworkCompletion_recordedByTeacherId_idx" ON "HomeworkCompletion"("recordedByTeacherId");

-- CreateIndex
CREATE INDEX "HomeworkCompletionAudit_homeworkCompletionId_idx" ON "HomeworkCompletionAudit"("homeworkCompletionId");

-- CreateIndex
CREATE INDEX "HomeworkSubmissionAttempt_homeworkApplicabilityId_idx" ON "HomeworkSubmissionAttempt"("homeworkApplicabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmissionAttempt_homeworkApplicabilityId_attemptNu_key" ON "HomeworkSubmissionAttempt"("homeworkApplicabilityId", "attemptNumber");

-- CreateIndex
CREATE INDEX "HomeworkReview_homeworkApplicabilityId_idx" ON "HomeworkReview"("homeworkApplicabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkReview_homeworkApplicabilityId_reviewNumber_key" ON "HomeworkReview"("homeworkApplicabilityId", "reviewNumber");

-- CreateIndex
CREATE INDEX "StudentEvaluation_studentId_idx" ON "StudentEvaluation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEvaluation_studentId_teacherId_academicSessionId_gra_key" ON "StudentEvaluation"("studentId", "teacherId", "academicSessionId", "gradeSubjectId");

-- CreateIndex
CREATE INDEX "ParentTeacherMeeting_studentId_idx" ON "ParentTeacherMeeting"("studentId");

-- CreateIndex
CREATE INDEX "ParentTeacherMeeting_schoolId_idx" ON "ParentTeacherMeeting"("schoolId");

-- CreateIndex
CREATE INDEX "ParentTeacherMeeting_teacherId_idx" ON "ParentTeacherMeeting"("teacherId");

-- CreateIndex
CREATE INDEX "AssessmentFramework_schoolId_idx" ON "AssessmentFramework"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentFramework_schoolId_name_key" ON "AssessmentFramework"("schoolId", "name");

-- CreateIndex
CREATE INDEX "AssessmentPeriod_frameworkId_idx" ON "AssessmentPeriod"("frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPeriod_frameworkId_name_key" ON "AssessmentPeriod"("frameworkId", "name");

-- CreateIndex
CREATE INDEX "AssessmentComponent_frameworkId_idx" ON "AssessmentComponent"("frameworkId");

-- CreateIndex
CREATE INDEX "AssessmentComponent_periodId_idx" ON "AssessmentComponent"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentComponent_frameworkId_periodId_name_key" ON "AssessmentComponent"("frameworkId", "periodId", "name");

-- CreateIndex
CREATE INDEX "GradingScale_schoolId_idx" ON "GradingScale"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScale_schoolId_name_key" ON "GradingScale"("schoolId", "name");

-- CreateIndex
CREATE INDEX "GradingScaleBand_gradingScaleId_idx" ON "GradingScaleBand"("gradingScaleId");

-- CreateIndex
CREATE INDEX "AssessmentFrameworkAssignment_academicSessionId_idx" ON "AssessmentFrameworkAssignment"("academicSessionId");

-- CreateIndex
CREATE INDEX "AssessmentFrameworkAssignment_schoolGradeId_idx" ON "AssessmentFrameworkAssignment"("schoolGradeId");

-- CreateIndex
CREATE INDEX "AssessmentFrameworkAssignment_frameworkId_idx" ON "AssessmentFrameworkAssignment"("frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentFrameworkAssignment_academicSessionId_schoolGrade_key" ON "AssessmentFrameworkAssignment"("academicSessionId", "schoolGradeId", "gradeSubjectId");

-- CreateIndex
CREATE INDEX "AssessmentComponentResult_studentId_idx" ON "AssessmentComponentResult"("studentId");

-- CreateIndex
CREATE INDEX "AssessmentComponentResult_gradeSubjectId_idx" ON "AssessmentComponentResult"("gradeSubjectId");

-- CreateIndex
CREATE INDEX "AssessmentComponentResult_assignmentId_idx" ON "AssessmentComponentResult"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentComponentResult_componentId_studentId_key" ON "AssessmentComponentResult"("componentId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentComponentResultAudit_resultId_idx" ON "AssessmentComponentResultAudit"("resultId");

-- CreateIndex
CREATE INDEX "AssessmentResultPublication_studentId_idx" ON "AssessmentResultPublication"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResultPublication_gradeSubjectId_studentId_key" ON "AssessmentResultPublication"("gradeSubjectId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MarkSheet_supersededByMarkSheetId_key" ON "MarkSheet"("supersededByMarkSheetId");

-- CreateIndex
CREATE INDEX "MarkSheet_studentId_idx" ON "MarkSheet"("studentId");

-- CreateIndex
CREATE INDEX "MarkSheet_schoolId_academicSessionId_idx" ON "MarkSheet"("schoolId", "academicSessionId");

-- CreateIndex
CREATE INDEX "MarkSheet_studentId_academicSessionId_status_idx" ON "MarkSheet"("studentId", "academicSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarkSheet_studentId_academicSessionId_version_key" ON "MarkSheet"("studentId", "academicSessionId", "version");

-- CreateIndex
CREATE INDEX "MarkSheetSubject_markSheetId_idx" ON "MarkSheetSubject"("markSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarkSheetSubject_markSheetId_gradeSubjectId_key" ON "MarkSheetSubject"("markSheetId", "gradeSubjectId");

-- CreateIndex
CREATE INDEX "MarkSheetGradingBandSnapshot_markSheetId_idx" ON "MarkSheetGradingBandSnapshot"("markSheetId");

-- CreateIndex
CREATE INDEX "MarkSheetCoScholasticResult_markSheetId_idx" ON "MarkSheetCoScholasticResult"("markSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarkSheetCoScholasticResult_markSheetId_areaId_key" ON "MarkSheetCoScholasticResult"("markSheetId", "areaId");

-- CreateIndex
CREATE INDEX "CoScholasticArea_schoolId_idx" ON "CoScholasticArea"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticArea_schoolId_name_key" ON "CoScholasticArea"("schoolId", "name");

-- CreateIndex
CREATE INDEX "CoScholasticPeriod_schoolGradeId_idx" ON "CoScholasticPeriod"("schoolGradeId");

-- CreateIndex
CREATE INDEX "CoScholasticPeriod_academicSessionId_idx" ON "CoScholasticPeriod"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticPeriod_schoolGradeId_academicSessionId_name_key" ON "CoScholasticPeriod"("schoolGradeId", "academicSessionId", "name");

-- CreateIndex
CREATE INDEX "CoScholasticGradeSetting_schoolId_idx" ON "CoScholasticGradeSetting"("schoolId");

-- CreateIndex
CREATE INDEX "CoScholasticGradeSetting_academicSessionId_idx" ON "CoScholasticGradeSetting"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticGradeSetting_schoolGradeId_academicSessionId_key" ON "CoScholasticGradeSetting"("schoolGradeId", "academicSessionId");

-- CreateIndex
CREATE INDEX "CoScholasticResult_studentId_idx" ON "CoScholasticResult"("studentId");

-- CreateIndex
CREATE INDEX "CoScholasticResult_areaId_idx" ON "CoScholasticResult"("areaId");

-- CreateIndex
CREATE INDEX "CoScholasticResult_academicSessionId_idx" ON "CoScholasticResult"("academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticResult_studentId_areaId_coScholasticPeriodId_key" ON "CoScholasticResult"("studentId", "areaId", "coScholasticPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAdmin_userId_organizationId_key" ON "OrganizationAdmin"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAccountant_userId_organizationId_key" ON "OrganizationAccountant"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalApproach_name_key" ON "EducationalApproach"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalApproach_slug_key" ON "EducationalApproach"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolApproach_schoolId_approachId_key" ON "SchoolApproach"("schoolId", "approachId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_userId_key" ON "CourseEnrollment"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_enrollmentId_key" ON "Certificate"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_gradeHistoryId_key" ON "Certificate"("gradeHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_megaIdUserId_key" ON "Instructor"("megaIdUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_userId_name_key" ON "Interest"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_studentId_addedByUserId_name_key" ON "Skill"("studentId", "addedByUserId", "name");

-- CreateIndex
CREATE INDEX "GeneralCalendarEntry_date_idx" ON "GeneralCalendarEntry"("date");

-- CreateIndex
CREATE INDEX "Event_schoolId_startsAt_idx" ON "Event"("schoolId", "startsAt");

-- CreateIndex
CREATE INDEX "SchoolCalendarEntry_schoolId_startDate_idx" ON "SchoolCalendarEntry"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "SchoolCalendarEntry_schoolId_endDate_idx" ON "SchoolCalendarEntry"("schoolId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Province_code_key" ON "Province"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Province_order_key" ON "Province"("order");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "District_provinceId_idx" ON "District"("provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalLevel_code_key" ON "LocalLevel"("code");

-- CreateIndex
CREATE INDEX "LocalLevel_districtId_idx" ON "LocalLevel"("districtId");

-- CreateIndex
CREATE INDEX "Address_provinceId_idx" ON "Address"("provinceId");

-- CreateIndex
CREATE INDEX "Address_districtId_idx" ON "Address"("districtId");

-- CreateIndex
CREATE INDEX "Address_localLevelId_idx" ON "Address"("localLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_userId_label_key" ON "Address"("userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Address_schoolId_label_key" ON "Address"("schoolId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Address_familyContactId_label_key" ON "Address"("familyContactId", "label");

-- CreateIndex
CREATE INDEX "FamilyContact_studentId_idx" ON "FamilyContact"("studentId");

-- CreateIndex
CREATE INDEX "FamilyContact_teacherId_idx" ON "FamilyContact"("teacherId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAdmin" ADD CONSTRAINT "SchoolAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAdmin" ADD CONSTRAINT "SchoolAdmin_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAccountant" ADD CONSTRAINT "SchoolAccountant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAccountant" ADD CONSTRAINT "SchoolAccountant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_interestsLockedForSessionId_fkey" FOREIGN KEY ("interestsLockedForSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSchoolAffiliation" ADD CONSTRAINT "TeacherSchoolAffiliation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSchoolAffiliation" ADD CONSTRAINT "TeacherSchoolAffiliation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSchoolAffiliation" ADD CONSTRAINT "StudentSchoolAffiliation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSchoolAffiliation" ADD CONSTRAINT "StudentSchoolAffiliation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGrade" ADD CONSTRAINT "SchoolGrade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGrade" ADD CONSTRAINT "SchoolGrade_gradeReferenceId_fkey" FOREIGN KEY ("gradeReferenceId") REFERENCES "GradeReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGradeAssignment" ADD CONSTRAINT "TeacherGradeAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGradeAssignment" ADD CONSTRAINT "TeacherGradeAssignment_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGradeAssignment" ADD CONSTRAINT "TeacherGradeAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_outcomeGradeId_fkey" FOREIGN KEY ("outcomeGradeId") REFERENCES "SchoolGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistoryAudit" ADD CONSTRAINT "GradeHistoryAudit_gradeHistoryId_fkey" FOREIGN KEY ("gradeHistoryId") REFERENCES "GradeHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistoryAudit" ADD CONSTRAINT "GradeHistoryAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubject" ADD CONSTRAINT "GradeSubject_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubject" ADD CONSTRAINT "GradeSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubject" ADD CONSTRAINT "GradeSubject_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAcademicAssignment" ADD CONSTRAINT "TeacherAcademicAssignment_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingUnit" ADD CONSTRAINT "TeachingUnit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTest" ADD CONSTRAINT "UnitTest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "TeachingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTest" ADD CONSTRAINT "UnitTest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTestResult" ADD CONSTRAINT "UnitTestResult_unitTestId_fkey" FOREIGN KEY ("unitTestId") REFERENCES "UnitTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTestResult" ADD CONSTRAINT "UnitTestResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTestResult" ADD CONSTRAINT "UnitTestResult_evaluatedByUserId_fkey" FOREIGN KEY ("evaluatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkApplicability" ADD CONSTRAINT "HomeworkApplicability_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkApplicability" ADD CONSTRAINT "HomeworkApplicability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCompletion" ADD CONSTRAINT "HomeworkCompletion_homeworkApplicabilityId_fkey" FOREIGN KEY ("homeworkApplicabilityId") REFERENCES "HomeworkApplicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCompletion" ADD CONSTRAINT "HomeworkCompletion_recordedByTeacherId_fkey" FOREIGN KEY ("recordedByTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCompletionAudit" ADD CONSTRAINT "HomeworkCompletionAudit_homeworkCompletionId_fkey" FOREIGN KEY ("homeworkCompletionId") REFERENCES "HomeworkCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCompletionAudit" ADD CONSTRAINT "HomeworkCompletionAudit_changedByTeacherId_fkey" FOREIGN KEY ("changedByTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmissionAttempt" ADD CONSTRAINT "HomeworkSubmissionAttempt_homeworkApplicabilityId_fkey" FOREIGN KEY ("homeworkApplicabilityId") REFERENCES "HomeworkApplicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmissionAttempt" ADD CONSTRAINT "HomeworkSubmissionAttempt_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_homeworkApplicabilityId_fkey" FOREIGN KEY ("homeworkApplicabilityId") REFERENCES "HomeworkApplicability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_submissionAttemptId_fkey" FOREIGN KEY ("submissionAttemptId") REFERENCES "HomeworkSubmissionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_reviewedByTeacherId_fkey" FOREIGN KEY ("reviewedByTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluationAudit" ADD CONSTRAINT "StudentEvaluationAudit_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StudentEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluationAudit" ADD CONSTRAINT "StudentEvaluationAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_linkedEvaluationId_fkey" FOREIGN KEY ("linkedEvaluationId") REFERENCES "StudentEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMeeting" ADD CONSTRAINT "ParentTeacherMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFramework" ADD CONSTRAINT "AssessmentFramework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFramework" ADD CONSTRAINT "AssessmentFramework_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPeriod" ADD CONSTRAINT "AssessmentPeriod_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "AssessmentFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "AssessmentFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AssessmentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingScale" ADD CONSTRAINT "GradingScale_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingScaleBand" ADD CONSTRAINT "GradingScaleBand_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentFrameworkAssignment" ADD CONSTRAINT "AssessmentFrameworkAssignment_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "AssessmentFramework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResult" ADD CONSTRAINT "AssessmentComponentResult_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResult" ADD CONSTRAINT "AssessmentComponentResult_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResult" ADD CONSTRAINT "AssessmentComponentResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentFrameworkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResult" ADD CONSTRAINT "AssessmentComponentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResult" ADD CONSTRAINT "AssessmentComponentResult_evaluatedByUserId_fkey" FOREIGN KEY ("evaluatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResultAudit" ADD CONSTRAINT "AssessmentComponentResultAudit_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AssessmentComponentResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponentResultAudit" ADD CONSTRAINT "AssessmentComponentResultAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResultPublication" ADD CONSTRAINT "AssessmentResultPublication_gradeSubjectId_fkey" FOREIGN KEY ("gradeSubjectId") REFERENCES "GradeSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResultPublication" ADD CONSTRAINT "AssessmentResultPublication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResultPublication" ADD CONSTRAINT "AssessmentResultPublication_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentFrameworkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResultPublication" ADD CONSTRAINT "AssessmentResultPublication_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_supersededByMarkSheetId_fkey" FOREIGN KEY ("supersededByMarkSheetId") REFERENCES "MarkSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetSubject" ADD CONSTRAINT "MarkSheetSubject_markSheetId_fkey" FOREIGN KEY ("markSheetId") REFERENCES "MarkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetGradingBandSnapshot" ADD CONSTRAINT "MarkSheetGradingBandSnapshot_markSheetId_fkey" FOREIGN KEY ("markSheetId") REFERENCES "MarkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetCoScholasticResult" ADD CONSTRAINT "MarkSheetCoScholasticResult_markSheetId_fkey" FOREIGN KEY ("markSheetId") REFERENCES "MarkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticArea" ADD CONSTRAINT "CoScholasticArea_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticPeriod" ADD CONSTRAINT "CoScholasticPeriod_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticPeriod" ADD CONSTRAINT "CoScholasticPeriod_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticGradeSetting" ADD CONSTRAINT "CoScholasticGradeSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticGradeSetting" ADD CONSTRAINT "CoScholasticGradeSetting_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticGradeSetting" ADD CONSTRAINT "CoScholasticGradeSetting_schoolGradeId_fkey" FOREIGN KEY ("schoolGradeId") REFERENCES "SchoolGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticGradeSetting" ADD CONSTRAINT "CoScholasticGradeSetting_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticResult" ADD CONSTRAINT "CoScholasticResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticResult" ADD CONSTRAINT "CoScholasticResult_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CoScholasticArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticResult" ADD CONSTRAINT "CoScholasticResult_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticResult" ADD CONSTRAINT "CoScholasticResult_coScholasticPeriodId_fkey" FOREIGN KEY ("coScholasticPeriodId") REFERENCES "CoScholasticPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticResult" ADD CONSTRAINT "CoScholasticResult_evaluatedByUserId_fkey" FOREIGN KEY ("evaluatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAdmin" ADD CONSTRAINT "OrganizationAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAdmin" ADD CONSTRAINT "OrganizationAdmin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAccountant" ADD CONSTRAINT "OrganizationAccountant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAccountant" ADD CONSTRAINT "OrganizationAccountant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolApproach" ADD CONSTRAINT "SchoolApproach_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolApproach" ADD CONSTRAINT "SchoolApproach_approachId_fkey" FOREIGN KEY ("approachId") REFERENCES "EducationalApproach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_approachId_fkey" FOREIGN KEY ("approachId") REFERENCES "EducationalApproach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuerOrganizationId_fkey" FOREIGN KEY ("issuerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuerSchoolId_fkey" FOREIGN KEY ("issuerSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_associatedSchoolId_fkey" FOREIGN KEY ("associatedSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_megaIdUserId_fkey" FOREIGN KEY ("megaIdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_approachId_fkey" FOREIGN KEY ("approachId") REFERENCES "EducationalApproach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEntry" ADD CONSTRAINT "SchoolCalendarEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEntry" ADD CONSTRAINT "SchoolCalendarEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalLevel" ADD CONSTRAINT "LocalLevel_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "LocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_familyContactId_fkey" FOREIGN KEY ("familyContactId") REFERENCES "FamilyContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContact" ADD CONSTRAINT "FamilyContact_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContact" ADD CONSTRAINT "FamilyContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyContact" ADD CONSTRAINT "FamilyContact_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

