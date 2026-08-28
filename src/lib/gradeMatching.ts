/**
 * Matches a school's free-text legacy grade value (Student.gradeLevel,
 * e.g. "Grade 6", "Class 6", "VI", "Nursery", "UKG") to a platform
 * GradeReference code ("Y6", "PP1", ...).
 *
 * Used during Initial Setup to pre-fill confident matches for a School
 * Admin to confirm. Deliberately conservative: returns null — never a
 * guess — whenever the input can't be matched with confidence. A null
 * result routes that student to manual assignment instead of a wrong
 * auto-match. See docs/PRODUCT_RULES.md.
 */

// Standard pre-primary naming, matched as whole-string keywords after
// normalization — not a substring search, to avoid false positives.
const PRE_PRIMARY_KEYWORDS: Record<string, string> = {
  nursery: "PP1",
  playgroup: "PP1",
  pp1: "PP1",
  lkg: "PP2",
  "lower kg": "PP2",
  "lower kindergarten": "PP2",
  pp2: "PP2",
  ukg: "PP3",
  "upper kg": "PP3",
  "upper kindergarten": "PP3",
  pp3: "PP3",
};

// I-X only — the platform's grade ladder tops out at Y10.
const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

// Whole words to strip before looking for a number — order doesn't
// matter, each is removed as a standalone token, never mid-word.
const FILLER_WORDS = new Set(["grade", "class", "std", "standard", "year"]);

const MIN_YEAR = 1;
const MAX_YEAR = 10;

function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,\-_/]/g, " ") // punctuation → spaces
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1") // "6th" -> "6"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param rawInput free-text grade value, e.g. Student.gradeLevel
 * @returns a GradeReference code ("PP1".."PP3", "Y1".."Y10"), or null
 *          if it can't be matched with confidence
 */
export function matchLegacyGradeText(rawInput: string | null | undefined): string | null {
  if (!rawInput) return null;

  const normalized = normalize(rawInput);
  if (!normalized) return null;

  // Pre-primary keywords are checked as a full-string match first —
  // they never contain a number, so there's no ambiguity with the
  // numeric path below.
  const keywordMatch = PRE_PRIMARY_KEYWORDS[normalized];
  if (keywordMatch) return keywordMatch;

  // Strip filler words token-by-token, then require the ENTIRE
  // remainder to be a single number or roman numeral — a partial/
  // substring match (e.g. pulling "6" out of "Room 6B") is exactly
  // the kind of over-eager guess this function must not make.
  const remainder = normalized
    .split(" ")
    .filter((token) => token && !FILLER_WORDS.has(token))
    .join(" ")
    .trim();

  if (!remainder) return null;

  if (/^\d+$/.test(remainder)) {
    const n = parseInt(remainder, 10);
    if (n >= MIN_YEAR && n <= MAX_YEAR) return `Y${n}`;
    return null; // out of range (e.g. "Grade 11", "Grade 0") — no guessing a clamp
  }

  const romanValue = ROMAN_NUMERALS[remainder];
  if (romanValue) return `Y${romanValue}`;

  return null;
}
