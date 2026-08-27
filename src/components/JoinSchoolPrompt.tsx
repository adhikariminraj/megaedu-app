"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SchoolPicker from "@/components/SchoolPicker";

type SchoolOption = { id: string; name: string; location: string | null };

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"];

export default function JoinSchoolPrompt({
  role,
  endpoint,
}: {
  role: "TEACHER" | "STUDENT";
  endpoint: string;
}) {
  const router = useRouter();
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [position, setPosition] = useState("Teacher");
  const [subjects, setSubjects] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!school) {
      setError("Please select your school.");
      return;
    }
    setLoading(true);
    setError(null);
    const body =
      role === "TEACHER"
        ? { schoolId: school.id, position, subjects }
        : { schoolId: school.id, gradeLevel };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-slate-800">
        Join Your School
      </h2>
      <p className="text-sm text-slate-500">
        Your school&apos;s administrator will need to approve your request
        before you appear as {role === "TEACHER" ? "staff" : "a student"}.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Your school</label>
        <SchoolPicker value={school} onChange={setSchool} />
      </div>

      {role === "TEACHER" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {position === "Teacher" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Subjects you teach
              </label>
              <input
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                placeholder="e.g. Mathematics, Science"
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
          )}
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Grade level</label>
          <input
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            placeholder="e.g. Grade 9"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-mega-green text-white font-semibold px-6 py-2.5 rounded-full hover:brightness-95 transition disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Join School"}
      </button>
    </form>
  );
}
