/**
 * Section names are stored as the bare label only (e.g. "A", "C") —
 * every display site across the app (Class Overview, Attendance,
 * Teacher dashboard, Evaluations, this page's own dropdowns) prepends
 * the word "Section" itself when rendering. Storing the prefix too
 * produces a doubled-up "Section Section C" wherever it's displayed.
 *
 * This strips a redundant leading "Section" (any case, with or without
 * a following dash/colon) from user input before it's ever saved, so
 * the stored value always matches the bare-label convention regardless
 * of what an admin actually typed into the field.
 */
export function normalizeSectionName(raw: string): string {
  return raw.trim().replace(/^section\s*[-:]?\s*/i, "").trim();
}
