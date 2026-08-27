"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const ROLE_OPTIONS = [
  { value: "STUDENT", label: "Student", accent: "border-mega-gold" },
  { value: "TEACHER", label: "Teacher / Staff", accent: "border-mega-green" },
  { value: "PARENT", label: "Parent", accent: "border-mega-red" },
  { value: "SCHOOL_ADMIN", label: "School", accent: "border-mega-navy" },
  { value: "ORGANIZATION_ADMIN", label: "Organization", accent: "border-mega-purple" },
] as const;

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<string>("STUDENT");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const preselect = searchParams.get("role");
    if (preselect && ROLE_OPTIONS.some((r) => r.value === preselect)) {
      setRole(preselect);
    }
  }, [searchParams]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.formErrors?.[0] || data.error || "Something went wrong.");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.push("/dashboard");
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Register for MEGA.EDU</h1>
      <p className="text-slate-500 mb-8">
        Create your MEGA ID first — you can connect it to your school,
        organization, or child right after, from your dashboard.
      </p>

      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-3">I am a...</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`text-sm font-semibold px-4 py-3 rounded-lg border-2 transition ${
                role === r.value
                  ? `${r.accent} bg-slate-50 text-slate-800`
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            required
            minLength={8}
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
        </div>

        {error && (
          <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-mega-navy text-white font-semibold py-3 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {loading ? "Creating your MEGA ID..." : "Create My MEGA ID"}
        </button>
      </form>

      <p className="text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-mega-blue font-medium">Log in</Link>
      </p>
    </div>
  );
}
