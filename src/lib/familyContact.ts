import { Prisma } from "@prisma/client";

export const STUDENT_CONTACT_RELATIONSHIPS = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "GRANDFATHER",
  "GRANDMOTHER",
  "BROTHER",
  "SISTER",
  "UNCLE",
  "AUNT",
  "OTHER",
] as const;

export const TEACHER_CONTACT_RELATIONSHIPS = [
  "SPOUSE",
  "FATHER",
  "MOTHER",
  "BROTHER",
  "SISTER",
  "SON",
  "DAUGHTER",
  "OTHER_CLOSE_RELATIVE",
  "OTHER",
] as const;

export type FamilyContactInput = {
  fullName?: unknown;
  relationship?: unknown;
  relationshipOther?: unknown;
  mobileNumber?: unknown;
  isPrimaryContact?: unknown;
  isGuardian?: unknown;
  isEmergencyContact?: unknown;
};

export type ValidatedFamilyContact = {
  fullName: string;
  relationship: string;
  relationshipOther: string | null;
  mobileNumber: string | null;
  isPrimaryContact: boolean;
  isGuardian: boolean;
  isEmergencyContact: boolean;
};

/**
 * Server-side source of truth for a Family Contact's core fields —
 * mirrors validateAddressInput()'s role for Address. Every write route
 * re-validates here rather than trusting the client.
 *
 * `allowedRelationships` is context-specific (Student vs Teacher — see
 * the two exported lists above) rather than a single hardcoded set, so
 * one validator serves both owner types without a Prisma enum.
 *
 * `allowGuardianFlag: false` (Teacher context) doesn't just omit the
 * field from the UI — it hard-ignores any client-supplied
 * `isGuardian` and forces the validated result to `false`, the same
 * "enforced server-side, not merely through the UI" standard already
 * applied to Primary Contact uniqueness below.
 */
export function validateFamilyContactInput(
  input: FamilyContactInput,
  options: { allowedRelationships: readonly string[]; allowGuardianFlag?: boolean }
): { error: string } | ValidatedFamilyContact {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const relationship = typeof input.relationship === "string" ? input.relationship : "";
  const relationshipOther = typeof input.relationshipOther === "string" ? input.relationshipOther.trim() : "";
  const mobileNumber = typeof input.mobileNumber === "string" ? input.mobileNumber.trim() : "";

  if (!fullName) return { error: "Full name is required." };
  if (!options.allowedRelationships.includes(relationship)) {
    return { error: "Please select a valid relationship." };
  }
  if (relationship === "OTHER" && !relationshipOther) {
    return { error: "Please specify the relationship when \"Other\" is selected." };
  }

  return {
    fullName,
    relationship,
    relationshipOther: relationship === "OTHER" ? relationshipOther : null,
    mobileNumber: mobileNumber || null,
    isPrimaryContact: input.isPrimaryContact === true,
    isGuardian: options.allowGuardianFlag === false ? false : input.isGuardian === true,
    isEmergencyContact: input.isEmergencyContact === true,
  };
}

export function isFamilyContactError(
  result: { error: string } | ValidatedFamilyContact
): result is { error: string } {
  return "error" in result;
}

/**
 * Enforces "at most one active-or-not Primary Contact per owner" —
 * shared by the Student and Teacher contact routes so the rule (and
 * its owner-scoping) exists exactly once. Pass `{ studentId }` or
 * `{ teacherId }`, never both — the caller's owner filter is what
 * keeps this from ever touching a different Student's or Teacher's
 * contacts.
 */
export async function clearOtherPrimaryContacts(
  tx: Prisma.TransactionClient,
  ownerFilter: { studentId: string } | { teacherId: string },
  excludeContactId?: string
) {
  await tx.familyContact.updateMany({
    where: {
      ...ownerFilter,
      isPrimaryContact: true,
      ...(excludeContactId ? { id: { not: excludeContactId } } : {}),
    },
    data: { isPrimaryContact: false },
  });
}
