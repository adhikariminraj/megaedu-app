"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Log in with MEGA ID</h1>
      <p className="text-slate-500 text-sm mb-8">
        One account for every role on MEGA.EDU.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>
        {error && <p className="text-sm text-mega-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-mega-navy text-white font-semibold py-3 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="text-sm text-slate-500 mt-6">
        No account yet?{" "}
        <Link href="/register" className="text-mega-blue font-medium">
          Register
        </Link>
      </p>
      <p className="text-sm text-slate-500 mt-2">
        Registering as a{" "}
        <Link href="/register?role=SCHOOL_ADMIN" className="text-mega-blue font-medium">School</Link>,{" "}
        <Link href="/register?role=TEACHER" className="text-mega-blue font-medium">Teacher/Staff</Link>,{" "}
        <Link href="/register?role=STUDENT" className="text-mega-blue font-medium">Student</Link>,{" "}
        <Link href="/register?role=PARENT" className="text-mega-blue font-medium">Parent</Link>, or{" "}
        <Link href="/register?role=ORGANIZATION_ADMIN" className="text-mega-blue font-medium">Organization</Link>{" "}
        all start the same way — one MEGA ID, then connect to your school or
        organization from your dashboard.
      </p>
    </div>
  );
}
