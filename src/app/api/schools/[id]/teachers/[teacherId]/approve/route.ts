import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";
import { syncTeacherBridgeFields, createTeacherAffiliation } from "@/lib/affiliation";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; teacherId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: params.id }, select: { name: true } });

  // The requested institutional relationship is resolved via the
  // affiliation table for (teacherId, schoolId) — never via the
  // single-valued Teacher.schoolId bridge field, which cannot
  // represent more than one open affiliation at a time and would
  // otherwise make a second school's approval unreachable while the
  // bridge is pointing at a different (still valid) school. The URL
  // schoolId (params.id) remains authoritative for which relationship
  // is being approved; requireSchoolAdmin above already confirmed this
  // admin is authorized for exactly that school.
  //
  // Some teachers have no affiliation row at all yet — e.g. added
  // directly by a School Admin, or registered before this phase — so
  // this only takes the affiliation-aware path when a row for this
  // exact (teacher, school) pair exists; otherwise it falls back to
  // the original direct bridge-field write, unchanged from before this
  // phase, gated by the same schoolId-equality check that route used
  // to use unconditionally.
  const approved = await prisma.$transaction(async (tx) => {
    const affiliation = await tx.teacherSchoolAffiliation.findFirst({
      where: { teacherId: params.teacherId, schoolId: params.id },
      orderBy: { createdAt: "desc" },
    });
    if (affiliation) {
      if (affiliation.status === "PENDING") {
        await tx.teacherSchoolAffiliation.update({ where: { id: affiliation.id }, data: { status: "ACTIVE" } });
      } else if (affiliation.status !== "ACTIVE") {
        return false; // ENDED — nothing pending at this school to approve
      }
      await syncTeacherBridgeFields(tx, params.teacherId);
      return true;
    }
    if (teacher.schoolId === params.id) {
      // Direct match — the simple, common, already-correct legacy case.
      await tx.teacher.update({ where: { id: params.teacherId }, data: { approved: true } });
      return true;
    }
    if (teacher.schoolId === null) {
      return false; // no relationship anywhere — unchanged from before
    }
    // Bridge field points at a DIFFERENT school than params.id. Only
    // trust that as "genuinely no relationship with params.id" when
    // this teacher has at most 1 open affiliation total — the case
    // syncTeacherBridgeFields() keeps accurate (see its own doc
    // comment in src/lib/affiliation.ts). With 2+ open affiliations,
    // the mismatch is explained by that documented "frozen, can't
    // represent a second school" behavior, not a real absence of any
    // relationship with params.id — so a functional-bug false rejection
    // is possible here (a teacher legitimately added the old, direct
    // way at params.id, who separately also holds 2+ real affiliations
    // elsewhere). requireSchoolAdmin() above already confirmed this
    // admin's own authority over params.id, so rather than trust the
    // ambiguous single-valued field, this formalizes the call's own
    // intent into a real affiliation row — the same JOIN primitive
    // every other approval path already produces, never a second,
    // parallel bridge-field write.
    const openElsewhere = await tx.teacherSchoolAffiliation.count({
      where: { teacherId: params.teacherId, status: { in: ["ACTIVE", "PENDING"] } },
    });
    if (openElsewhere <= 1) return false; // bridge field is trustworthy here — genuinely a different school
    await createTeacherAffiliation(tx, {
      teacherId: params.teacherId,
      schoolId: params.id,
      status: "ACTIVE",
      position: teacher.position,
      subjects: teacher.subjects,
    });
    return true;
  });
  if (!approved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Nothing to notify if this teacher has no linked MEGA account yet.
  if (teacher.userId) {
    await notify(
      teacher.userId,
      "STAFF_APPROVED",
      `You're approved at ${school?.name || "your school"}!`,
      "Your account is now active — you have full access to your school dashboard."
    );
  }

  return NextResponse.json({ ok: true });
}
