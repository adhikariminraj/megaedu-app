"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type MeetingActionRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  studentName?: string;
  scheduledAt: string;
  location: string | null;
  onlineUrl: string | null;
  status: string;
  outcomeNotes: string | null;
};
type EvaluationOption = { id: string; teacherName: string; remarks: string };

/**
 * Shared schedule/complete/cancel/reschedule/link-evaluation UI for
 * Parent-Teacher Meetings — the single implementation reused by the
 * General Evaluations page, the Subject Evaluations panel, and the
 * cross-cutting Meetings management page, so this logic exists exactly
 * once rather than three times. Calls the same two routes every caller
 * already used: POST .../meetings (create) and PATCH
 * .../meetings/[meetingId] (status/outcome/link/reschedule).
 */
export default function MeetingActions({
  schoolId,
  studentId,
  gradeSubjectId,
  meetings,
  evaluations = [],
  isAdmin,
  myTeacherId,
  teacherOptions,
  allowCreate = true,
  showStudentName = false,
}: {
  schoolId: string;
  studentId?: string;
  gradeSubjectId?: string | null;
  meetings: MeetingActionRow[];
  evaluations?: EvaluationOption[];
  isAdmin: boolean;
  myTeacherId: string | null;
  teacherOptions: { id: string; name: string }[];
  allowCreate?: boolean;
  showStudentName?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ teacherId: "", scheduledAt: "" });
  const [outcomeDraftFor, setOutcomeDraftFor] = useState<string | null>(null);
  const [outcomeDraft, setOutcomeDraft] = useState("");
  const [outcomeLinkedEvalId, setOutcomeLinkedEvalId] = useState("");
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ scheduledAt: "", location: "" });

  async function call(url: string, options: RequestInit) {
    setError(null);
    setBusy(true);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return body;
  }

  async function scheduleMeeting() {
    if (!studentId) return;
    if (!meetingForm.scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    if (isAdmin && !meetingForm.teacherId) {
      setError("Select which teacher this meeting is with.");
      return;
    }
    const ok = await call(`/api/schools/${schoolId}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetings: [
          {
            studentId,
            scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
            ...(gradeSubjectId ? { gradeSubjectId } : {}),
            ...(isAdmin ? { teacherId: meetingForm.teacherId } : {}),
          },
        ],
      }),
    });
    if (ok) {
      setScheduling(false);
      setMeetingForm({ teacherId: "", scheduledAt: "" });
    }
  }

  async function completeMeeting(meetingId: string) {
    const ok = await call(`/api/schools/${schoolId}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "COMPLETED",
        outcomeNotes: outcomeDraft,
        ...(outcomeLinkedEvalId ? { linkedEvaluationId: outcomeLinkedEvalId } : {}),
      }),
    });
    if (ok) {
      setOutcomeDraftFor(null);
      setOutcomeDraft("");
      setOutcomeLinkedEvalId("");
    }
  }

  async function cancelMeeting(meetingId: string) {
    await call(`/api/schools/${schoolId}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
  }

  async function saveReschedule(meetingId: string) {
    if (!rescheduleForm.scheduledAt) {
      setError("Pick a new date and time.");
      return;
    }
    const ok = await call(`/api/schools/${schoolId}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: new Date(rescheduleForm.scheduledAt).toISOString(),
        location: rescheduleForm.location || null,
      }),
    });
    if (ok) {
      setReschedulingId(null);
      setRescheduleForm({ scheduledAt: "", location: "" });
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-mega-red mb-2">{error}</p>}

      {meetings.length === 0 && !allowCreate && (
        <p className="text-xs text-slate-400 mb-2">None scheduled.</p>
      )}

      <div className="space-y-2 mb-2">
        {meetings.map((m) => {
          const mine = isAdmin || m.teacherId === myTeacherId;
          return (
            <div key={m.id} className="border border-slate-100 rounded-lg p-2 text-xs">
              <div className="flex items-center justify-between">
                <span>
                  {showStudentName && m.studentName ? `${m.studentName} — ` : ""}
                  {m.teacherName} — {new Date(m.scheduledAt).toLocaleString()}
                  {m.location ? ` — ${m.location}` : ""}
                </span>
                <span className="font-semibold">{m.status}</span>
              </div>
              {m.status === "COMPLETED" && m.outcomeNotes && (
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.outcomeNotes}</p>
              )}
              {mine && m.status === "SCHEDULED" && (
                <div className="mt-1 space-y-1">
                  {reschedulingId === m.id ? (
                    <div className="space-y-1">
                      <input
                        type="datetime-local"
                        value={rescheduleForm.scheduledAt}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1"
                      />
                      <input
                        value={rescheduleForm.location}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Location / link (optional)"
                        className="w-full border border-slate-200 rounded-lg px-2 py-1"
                      />
                      <div className="flex gap-3">
                        <button onClick={() => saveReschedule(m.id)} disabled={busy} className="text-mega-navy font-medium disabled:opacity-50">
                          Save New Time
                        </button>
                        <button onClick={() => setReschedulingId(null)} className="text-slate-500">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : outcomeDraftFor === m.id ? (
                    <>
                      <textarea
                        value={outcomeDraft}
                        onChange={(e) => setOutcomeDraft(e.target.value)}
                        rows={2}
                        placeholder="What was discussed / outcome..."
                        className="w-full border border-slate-200 rounded-lg px-2 py-1"
                      />
                      {evaluations.length > 0 && (
                        <select
                          value={outcomeLinkedEvalId}
                          onChange={(e) => setOutcomeLinkedEvalId(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1"
                        >
                          <option value="">Link a prepared evaluation (optional)...</option>
                          {evaluations.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.teacherName}: {ev.remarks.slice(0, 40)}
                              {ev.remarks.length > 40 ? "..." : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-3">
                        <button onClick={() => completeMeeting(m.id)} disabled={busy} className="text-mega-green font-medium disabled:opacity-50">
                          Mark Completed
                        </button>
                        <button onClick={() => setOutcomeDraftFor(null)} className="text-slate-500">
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setOutcomeDraftFor(m.id);
                          setOutcomeDraft("");
                        }}
                        className="text-mega-green font-medium"
                      >
                        Mark Completed
                      </button>
                      <button
                        onClick={() => {
                          setReschedulingId(m.id);
                          setRescheduleForm({ scheduledAt: "", location: m.location ?? "" });
                        }}
                        className="text-mega-blue font-medium"
                      >
                        Reschedule
                      </button>
                      <button onClick={() => cancelMeeting(m.id)} disabled={busy} className="text-slate-500 disabled:opacity-50">
                        Cancel Meeting
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allowCreate &&
        (scheduling ? (
          <div className="space-y-1">
            {isAdmin && (
              <select
                value={meetingForm.teacherId}
                onChange={(e) => setMeetingForm((f) => ({ ...f, teacherId: e.target.value }))}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
              >
                <option value="">Meeting with teacher...</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="datetime-local"
              value={meetingForm.scheduledAt}
              onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
            />
            <div className="flex gap-2">
              <button
                onClick={scheduleMeeting}
                disabled={busy}
                className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Schedule
              </button>
              <button onClick={() => setScheduling(false)} className="text-xs text-slate-500">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setScheduling(true)} className="text-xs text-mega-blue font-medium">
            + Schedule Meeting
          </button>
        ))}
    </div>
  );
}
