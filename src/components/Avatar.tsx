import Image from "next/image";

// The 5 brand accent colors from the wordmark (tailwind.config.js) —
// reused deterministically for initials fallbacks so the same
// person/school always gets the same color, no randomness.
const PALETTE = [
  { bg: "bg-mega-navy", text: "text-white" },
  { bg: "bg-mega-green", text: "text-white" },
  { bg: "bg-mega-gold", text: "text-white" },
  { bg: "bg-mega-red", text: "text-white" },
  { bg: "bg-mega-blue", text: "text-white" },
  { bg: "bg-mega-purple", text: "text-white" },
] as const;

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string, variant: "person" | "school") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (variant === "school") {
    // Institutions read better as one or two strong initials (e.g.
    // "Sunrise Academy" -> "SA"), same idea as a crest/monogram.
    return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  }
  // A person reads better as first + last initial, skipping any middle
  // names, matching how a name badge would abbreviate a full name.
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const SIZE_PX: Record<"sm" | "md" | "lg" | "xl", number> = { sm: 28, md: 40, lg: 56, xl: 88 };
const TEXT_SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-lg",
  xl: "text-2xl",
};

export default function Avatar({
  src,
  name,
  variant = "person",
  size = "md",
  className = "",
}: {
  src?: string | null;
  name: string;
  /** "person" renders a circle (Student/Teacher/Parent photos); "school"
   * renders a softly rounded square with a border, reading as an
   * institution mark rather than a personal photo. */
  variant?: "person" | "school";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const px = SIZE_PX[size];
  const shape = variant === "person" ? "rounded-full" : "rounded-xl";

  if (src) {
    return (
      <span
        className={`relative inline-block overflow-hidden shrink-0 ${shape} ${
          variant === "school" ? "border border-slate-200 bg-white" : ""
        } ${className}`}
        style={{ width: px, height: px }}
      >
        <Image
          src={src}
          alt={name}
          fill
          sizes={`${px}px`}
          className={variant === "school" ? "object-contain p-1" : "object-cover"}
        />
      </span>
    );
  }

  // Schools get a consistent, bordered navy-on-white monogram — an
  // institutional mark, not a randomly-colored circle — so it also
  // stays legible when placed on a navy background (e.g. the school
  // profile header) rather than risking a navy-on-navy collision.
  // People keep the playful per-person palette, which has no such
  // fixed-background constraint anywhere it's used.
  const fallbackClasses =
    variant === "school"
      ? "bg-white text-mega-navy border border-slate-200"
      : `${colorFor(name || "?").bg} ${colorFor(name || "?").text}`;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 font-semibold ${shape} ${fallbackClasses} ${TEXT_SIZE[size]} ${className}`}
      style={{ width: px, height: px }}
      title={name}
      aria-label={name}
    >
      {initialsFor(name, variant)}
    </span>
  );
}
