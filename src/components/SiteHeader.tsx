"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function SiteHeader() {
  const { data: session, status } = useSession();

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
          <Link href="/schools" className="hover:text-mega-navy">Schools</Link>
          <Link href="/courses" className="hover:text-mega-navy">Courses</Link>
          <Link href="/opportunities" className="hover:text-mega-navy">Opportunities</Link>
          <Link href="/organizations" className="hover:text-mega-navy">Organizations</Link>
          <Link href="/resources" className="hover:text-mega-navy">Resources</Link>
          <Link href="/approaches" className="hover:text-mega-navy">Approaches</Link>
        </nav>

        <div className="flex items-center gap-3">
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
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
