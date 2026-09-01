"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";

const NAV_LINKS = [
  { href: "/schools", label: "Schools" },
  { href: "/courses", label: "Courses" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/about", label: "About" },
];

export default function SiteHeader() {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setUnreadCount(0);
      setAvatarUrl(null);
      return;
    }
    fetch("/api/notifications/unread-count")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.count || 0))
      .catch(() => {});
    fetch("/api/user/avatar")
      .then((res) => res.json())
      .then((data) => setAvatarUrl(data.avatarUrl || null))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    setMenuOpen(false);
  }, [status]);

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-semibold">
            <span className="text-mega-navy">mega</span>
            <span className="text-mega-red">.</span>
            <span className="text-mega-gold">e</span>
            <span className="text-mega-blue">d</span>
            <span className="text-mega-green">u</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-mega-navy">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              {(session?.user as any)?.roles?.includes("PLATFORM_ADMIN") && (
                <Link
                  href="/admin/schools"
                  className="text-sm font-medium text-mega-red hover:text-red-700"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/notifications"
                className="relative text-sm font-medium text-slate-700 hover:text-mega-navy"
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-mega-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-700 hover:text-mega-navy"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm font-medium text-slate-500 hover:text-mega-red"
              >
                Sign out
              </button>
              <Link href="/dashboard/profile" title="My Profile">
                <Avatar src={avatarUrl} name={session?.user?.name || "?"} size="sm" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-mega-navy">
                Log in
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold bg-mega-navy text-white px-4 py-2 rounded-full hover:bg-mega-blue transition"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden flex items-center justify-center w-10 h-10 -mr-2 text-slate-700"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1 text-sm font-medium text-slate-600">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="py-2.5 hover:text-mega-navy"
              >
                {l.label}
              </Link>
            ))}

            <div className="h-px bg-slate-100 my-2" />

            {status === "authenticated" ? (
              <>
                {(session?.user as any)?.roles?.includes("PLATFORM_ADMIN") && (
                  <Link
                    href="/admin/schools"
                    onClick={() => setMenuOpen(false)}
                    className="py-2.5 font-medium text-mega-red"
                  >
                    Admin
                  </Link>
                )}
                <Link href="/notifications" onClick={() => setMenuOpen(false)} className="py-2.5">
                  Notifications{unreadCount > 0 ? ` (${unreadCount > 9 ? "9+" : unreadCount})` : ""}
                </Link>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="py-2.5">
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMenuOpen(false)}
                  className="py-2.5 flex items-center gap-2"
                >
                  <Avatar src={avatarUrl} name={session?.user?.name || "?"} size="sm" />
                  My Profile
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="py-2.5 text-left text-slate-500"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="py-2.5">
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 text-center text-sm font-semibold bg-mega-navy text-white px-4 py-2.5 rounded-full"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
