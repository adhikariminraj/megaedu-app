// Whole-Ecosystem Refinement F — read-only labeling for the informational
// "also linked as" note shown on a resolved dashboard, not a permission
// hierarchy or a context switcher. /dashboard/page.tsx picks ONE dashboard
// per MEGA ID using a fixed priority order (see the comment above the
// SCHOOL_ADMIN branch); this only clarifies, after that pick, which other
// roles the same MEGA ID also holds — using the exact same session.roles
// array the priority chain itself reads, so it can never claim a role the
// user doesn't actually have.

export const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  ORGANIZATION_ADMIN: "Organization Admin",
  ACCOUNTANT: "Accountant",
};

export function describeOtherRoles(roles: string[] | undefined, current: string): string | undefined {
  const others = (roles ?? [])
    .filter((r) => r !== current && ROLE_LABELS[r])
    .map((r) => ROLE_LABELS[r]);
  if (others.length === 0) return undefined;
  const currentLabel = ROLE_LABELS[current] ?? current;
  return `Your MEGA ID is also linked as ${others.join(", ")}. This is your ${currentLabel} view.`;
}
