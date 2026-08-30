"use client";

import { useRouter } from "next/navigation";
import MeetingActions from "@/components/MeetingActions";

type MeetingWithContext = {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  subjectName: string | null;
  scheduledAt: string;
  location: string | null;
  onlineUrl: string | null;
  status: string;
  outcomeNotes: string | null;
  evaluationOptions: { id: string; teacherName: string; remarks: string }[];
};

export default function MeetingsClient({
  schoolId,
  isAdmin,
  myTeacherId,
  teacherOptions,
  selectedTeacherId,
  selectedStatus,
  selectedWhen,
  meetings,
}: {
  schoolId: string;
  isAdmin: boolean;
  myTeacherId: string | null;
  teacherOptions: { id: string; name: string }[];
  selectedTeacherId: string | null;
  selectedStatus: string | null;
  selectedWhen: string;
  meetings: MeetingWithContext[];
}) {
  const router = useRouter();

  function navigate(next: { teacher?: string | null; status?: string | null; when?: string }) {
    const qs = new URLSearchParams();
    const teacher = next.teacher !== undefined ? next.teacher : selectedTeacherId;
    const status = next.status !== undefined ? next.status : selectedStatus;
    const when = next.when !== undefined ? next.when : selectedWhen;
    if (teacher) qs.set("teacher", teacher);
    if (status) qs.set("status", status);
    if (when && when !== "all") qs.set("when", when);
    router.push(`/dashboard/meetings${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">
        {isAdmin ? "Parent-Teacher Meetings — School" : "Your Parent-Teacher Meetings"}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {isAdmin
          ? "Every meeting scheduled at your school, any teacher, any grade."
          : "Every meeting you're scheduled for, across every grade and subject."}
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {isAdmin && (
          <select
            value={selectedTeacherId ?? ""}
            onChange={(e) => navigate({ teacher: e.target.value || null })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All teachers</option>
            {teacherOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={selectedStatus ?? ""}
          onChange={(e) => navigate({ status: e.target.value || null })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={selectedWhen}
          onChange={(e) => navigate({ when: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All time</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
      </div>

      {meetings.length === 0 ? (
        <p className="text-slate-400 text-sm">No meetings match these filters.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="border border-slate-200 rounded-xl p-3">
              <p className="text-sm font-medium text-slate-800 mb-2">
                {m.studentName}
                {m.subjectName ? ` — ${m.subjectName}` : " — General"}
              </p>
              <MeetingActions
                schoolId={schoolId}
                meetings={[
                  {
                    id: m.id,
                    teacherId: m.teacherId,
                    teacherName: m.teacherName,
                    scheduledAt: m.scheduledAt,
                    location: m.location,
                    onlineUrl: m.onlineUrl,
                    status: m.status,
                    outcomeNotes: m.outcomeNotes,
                  },
                ]}
                evaluations={m.evaluationOptions}
                isAdmin={isAdmin}
                myTeacherId={myTeacherId}
                teacherOptions={teacherOptions}
                allowCreate={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
