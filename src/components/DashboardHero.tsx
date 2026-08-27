"use client";

import Link from "next/link";

export type HeroCard = {
  icon: string; // single emoji, keeps this dependency-free
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  cta?: string; // omit for a static, non-interactive info card
  accent?: "navy" | "gold" | "green" | "purple" | "red";
};

const ACCENT_BG: Record<string, string> = {
  navy: "bg-blue-50",
  gold: "bg-amber-50",
  green: "bg-green-50",
  purple: "bg-purple-50",
  red: "bg-red-50",
};

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHero({
  name,
  subtitle,
  cards,
}: {
  name: string;
  subtitle?: string;
  cards: HeroCard[];
}) {
  const firstName = name.split(" ")[0];

  return (
    <div className="mb-10">
      <div
        className="relative rounded-2xl overflow-hidden text-white bg-cover bg-center mb-6"
        style={{ backgroundImage: "url('/hero-himalaya.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/55 via-slate-900/45 to-slate-900/65" />
        <div className="relative px-8 py-12">
          <h1 className="text-2xl md:text-3xl font-bold drop-shadow-md">
            {timeGreeting()}, {firstName}.
          </h1>
          {subtitle && <p className="text-slate-100 mt-1 drop-shadow">{subtitle}</p>}
        </div>
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c, i) => {
            const inner = (
              <>
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="font-semibold text-slate-800 text-sm">{c.title}</p>
                <p className="text-xs text-slate-500 mt-1 mb-3">{c.description}</p>
                {c.cta && <span className="text-xs font-semibold text-mega-navy">{c.cta} →</span>}
              </>
            );
            const className = `block text-left w-full rounded-xl p-5 border border-slate-200 ${
              c.href || c.onClick ? "hover:shadow-md transition" : ""
            } ${ACCENT_BG[c.accent || "navy"]}`;

            if (c.onClick) {
              return (
                <button key={i} onClick={c.onClick} className={className}>
                  {inner}
                </button>
              );
            }
            if (c.href) {
              return (
                <Link key={i} href={c.href} className={className}>
                  {inner}
                </Link>
              );
            }
            return (
              <div key={i} className={className}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
