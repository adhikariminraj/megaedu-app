"use client";

import { useState, useEffect } from "react";

type Skill = { id: string; name: string; addedBy: { name: string } };
type StudentWithSkills = {
  id: string;
  gradeLevel: string | null;
  user: { name: string };
  skills: Skill[];
};

export default function StudentSkillManager({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState<StudentWithSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadStudents() {
    setLoading(true);
    const res = await fetch(`/api/schools/${schoolId}/students`);
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  }

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function addSkill(studentId: string) {
    if (!newSkill.trim()) return;
    setError(null);
    const res = await fetch(`/api/schools/${schoolId}/students/${studentId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSkill.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setNewSkill("");
    loadStudents();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading students...</p>;

  if (students.length === 0) {
    return <p className="text-sm text-slate-400">No approved students at your school yet.</p>;
  }

  return (
    <div className="space-y-3">
      {students.map((s) => (
        <div key={s.id} className="border border-slate-200 rounded-xl p-4">
          <button
            onClick={() => setOpenStudentId(openStudentId === s.id ? null : s.id)}
            className="w-full text-left flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-slate-800">{s.user.name}</p>
              <p className="text-xs text-slate-400">
                {s.gradeLevel || "No grade set"} · {s.skills.length} skill{s.skills.length !== 1 ? "s" : ""}
              </p>
            </div>
            <span className="text-slate-400 text-sm">{openStudentId === s.id ? "−" : "+"}</span>
          </button>

          {openStudentId === s.id && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {s.skills.length === 0 && <p className="text-xs text-slate-400">No skills added yet.</p>}
                {s.skills.map((sk) => (
                  <span
                    key={sk.id}
                    title={`Added by ${sk.addedBy.name}`}
                    className="text-xs bg-green-50 text-mega-green font-medium rounded-full px-3 py-1"
                  >
                    {sk.name} · {sk.addedBy.name}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="e.g. Robotics, Public Speaking"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <button
                  onClick={() => addSkill(s.id)}
                  className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition"
                >
                  Add Skill
                </button>
              </div>
              {error && <p className="text-xs text-mega-red">{error}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
