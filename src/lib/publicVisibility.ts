/**
 * Public visibility rule for institution-owned content that can belong to
 * either a School or an Organization (Opportunity, Resource): the owner
 * must be currently verified AND active — the same `verified && isActive`
 * guard /schools, /schools/[slug] and /organizations/[slug] already
 * enforce for the institution itself. Deliberately NOT academyParticipant:
 * that flag governs MEGA Academy courses only (see
 * docs/ORGANIZATION_INSTITUTIONAL_CONTEXT.md). Content with no owner at
 * all has no verified institution behind it, so it is never public.
 */
export function eligibleContentOwnerWhere() {
  return {
    OR: [
      { school: { is: { verified: true, isActive: true } } },
      { organization: { is: { verified: true, isActive: true } } },
    ],
  };
}
