"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

type RosterRow = {
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  sectionName: string | null;
  attendanceId: string | null;
  status: string | null;
  remarks: string | null;
};
type GradeOption = {
  id: string;
  displayName: string;
  wholeGradeAllowed: boolean;
  sections: { id: string; name: string }[];
};

export default function AttendanceClient({
  schoolId,
  academicSessionId,
  gradeOptions,
  selectedGradeId,
  selectedSectionId,
  selectedDate,
  roster,
}: {
  schoolId: string;
  academicSessionId: string;
  gradeOptions: GradeOption[];
  selectedGradeId: string;
  selectedSectionId: string | null;
  selectedDate: string;
  roster: RosterRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, { status: string; remarks: string }>>({});
  const [corrections, setCorrections] = useState<Record<string, { status: string; remarks: string }>>({});

  const grade = gradeOptions.find((g) => g.id === selectedGradeId)!;

  function navigate(params: { grade?: string; section?: string; date?: string }) {
    const next = new URLSearchParams();
    next.set("grade", params.grade ?? selectedGradeId);
    if (params.section !== undefined ? params.section : selectedSectionId) {
      next.set("section", params.section !== undefined ? params.section : selectedSectionId!);
    }
    next.set("date", params.date ?? selectedDate);
    router.push(`/dashboard/attendance?${next.toString()}`);
  }

  async function saveAttendance() {
    setError(null);
    setNotice(null);
    const records = Object.entries(pending).map(([studentId, v]) => ({
      studentId,
      status: v.status,
      remarks: v.remarks || undefined,
    }));
    if (records.length === 0) {
      setError("Set a status for at least one student first.");
      return;
    }
    const res = await fetch(`/api/schools/${schoolId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicSessionId,
        schoolGradeId: selectedGradeId,
        sectionId: selectedSectionId,
        date: selectedDate,
        records,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setNotice(`Marked ${body.created} student(s).${body.skipped ? ` ${body.skipped} already had a record for this day.` : ""}`);
    setPending({});
    router.refresh();
  }

  async function correctAttendance(attendanceId: string) {
    setError(null);
    const c = corrections[attendanceId];
    if (!c) return;
    const res = await fetch(`/api/schools/${schoolId}/attendance/${attendanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: c.status, remarks: c.remarks }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setCorrections((prev) => {
      const next = { ...prev };
      delete next[attendanceId];
      return next;
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Attendance</h1>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>
      )}
      {notice && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-3 text-sm text-green-700 mb-4">{notice}</div>
      )}

      <div className="flex gap-2 mb-6">
        <select
          value={selectedGradeId}
          onChange={(e) => navigate({ grade: e.target.value, section: "" })}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
        >
          {gradeOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.displayName}
            </option>
          ))}
        </select>
        {(grade.sections.length > 0 || !grade.wholeGradeAllowed) && (
          <select
            value={selectedSectionId ?? ""}
            onChange={(e) => navigate({ section: e.target.value })}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
          >
            {grade.wholeGradeAllowed && <option value="">Whole grade</option>}
            {grade.sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => navigate({ date: e.target.value })}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
        />
      </div>

      {roster.length === 0 ? (
        <p className="text-slate-400 text-sm">No students in this scope for the current session.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => {
            const isMarked = !!r.attendanceId;
            const correction = r.attendanceId ? corrections[r.attendanceId] : undefined;
            const draft = pending[r.studentId];
            return (
              <div key={r.studentId} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Avatar src={r.avatarUrl} name={r.studentName} size="sm" />
                    {r.studentName}
                    {r.sectionName && <span className="text-slate-400"> — Section {r.sectionName}</span>}
                  </span>
                  {isMarked && !correction && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-mega-navy">
                      {r.status}
                    </span>
                  )}
                </div>

                {!isMarked ? (
                  <div className="flex gap-2">
                    <select
                      value={draft?.status ?? ""}
                      onChange={(e) =>
                        setPending((p) => ({ ...p, [r.studentId]: { status: e.target.value, remarks: draft?.remarks ?? "" } }))
                      }
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="">Status...</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft?.remarks ?? ""}
                      onChange={(e) =>
                        setPending((p) => ({ ...p, [r.studentId]: { status: draft?.status ?? "", remarks: e.target.value } }))
                      }
                      placeholder="Remarks (optional)"
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1"
                    />
                  </div>
                ) : correction ? (
                  <div className="flex gap-2">
                    <select
                      value={correction.status}
                      onChange={(e) =>
                        setCorrections((p) => ({ ...p, [r.attendanceId!]: { ...correction, status: e.target.value } }))
                      }
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      value={correction.remarks}
                      onChange={(e) =>
                        setCorrections((p) => ({ ...p, [r.attendanceId!]: { ...correction, remarks: e.target.value } }))
                      }
                      placeholder="Remarks"
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1"
                    />
                    <button
                      onClick={() => correctAttendance(r.attendanceId!)}
                      className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setCorrections((p) => ({ ...p, [r.attendanceId!]: { status: r.status || "PRESENT", remarks: r.remarks || "" } }))
                    }
                    className="text-xs text-mega-blue"
                  >
                    {r.remarks ? `"${r.remarks}" — ` : ""}Correct →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {roster.some((r) => !r.attendanceId) && (
        <button
          onClick={saveAttendance}
          className="mt-6 text-sm font-semibold text-white bg-mega-navy rounded-lg px-4 py-2"
        >
          Save Attendance
        </button>
      )}
    </div>
  );
}
