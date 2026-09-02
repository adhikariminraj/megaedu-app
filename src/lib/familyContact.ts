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
 */
export function validateFamilyContactInput(input: FamilyContactInput): { error: string } | ValidatedFamilyContact {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const relationship = typeof input.relationship === "string" ? input.relationship : "";
  const relationshipOther = typeof input.relationshipOther === "string" ? input.relationshipOther.trim() : "";
  const mobileNumber = typeof input.mobileNumber === "string" ? input.mobileNumber.trim() : "";

  if (!fullName) return { error: "Full name is required." };
  if (!STUDENT_CONTACT_RELATIONSHIPS.includes(relationship as (typeof STUDENT_CONTACT_RELATIONSHIPS)[number])) {
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
    isGuardian: input.isGuardian === true,
    isEmergencyContact: input.isEmergencyContact === true,
  };
}

export function isFamilyContactError(
  result: { error: string } | ValidatedFamilyContact
): result is { error: string } {
  return "error" in result;
}
