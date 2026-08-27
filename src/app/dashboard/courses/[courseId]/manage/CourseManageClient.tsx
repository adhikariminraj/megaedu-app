"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lesson = { id: string; title: string; content: string; videoUrl: string | null };
type CourseModule = { id: string; title: string; lessons: Lesson[] };
type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  published: boolean;
  modules: CourseModule[];
};

export default function CourseManageClient({ course }: { course: Course }) {
  const router = useRouter();
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [lessonForms, setLessonForms] = useState<Record<string, { title: string; content: string; videoUrl: string }>>({});
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    await fetch(`/api/courses/${course.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newModuleTitle }),
    });
    setNewModuleTitle("");
    router.refresh();
  }

  async function addLesson(moduleId: string) {
    const form = lessonForms[moduleId];
    if (!form?.title.trim() || !form?.content.trim()) return;
    await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLessonForms({ ...lessonForms, [moduleId]: { title: "", content: "", videoUrl: "" } });
    router.refresh();
  }

  async function togglePublish() {
    setPublishing(true);
    await fetch(`/api/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !course.published }),
    });
    setPublishing(false);
    router.refresh();
  }

  const hasContent = course.modules.some((m) => m.lessons.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-sm text-mega-blue font-medium">
        ← Back to your courses
      </Link>

      <div className="flex items-center justify-between mt-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{course.title}</h1>
          {course.description && <p className="text-slate-500 mt-1">{course.description}</p>}
        </div>
        <button
          onClick={togglePublish}
          disabled={publishing || (!course.published && !hasContent)}
          title={!course.published && !hasContent ? "Add at least one lesson before publishing" : ""}
          className={`text-sm font-semibold px-5 py-2.5 rounded-full transition disabled:opacity-40 ${
            course.published
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-mega-green text-white hover:brightness-95"
          }`}
        >
          {publishing ? "..." : course.published ? "Unpublish" : "Publish Course"}
        </button>
      </div>

      {course.published && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-8">
          Live in the catalogue:{" "}
          <a href={`/courses/${course.slug}`} className="underline">
            /courses/{course.slug}
          </a>
        </p>
      )}

      <h2 className="text-lg font-semibold text-slate-800 mb-4">Modules &amp; Lessons</h2>

      <div className="space-y-4 mb-8">
        {course.modules.map((m, i) => (
          <div key={m.id} className="border border-slate-200 rounded-xl p-5">
            <button
              onClick={() => setOpenModuleId(openModuleId === m.id ? null : m.id)}
              className="w-full text-left font-medium text-slate-800 flex items-center justify-between"
            >
              <span>
                Module {i + 1}: {m.title} ({m.lessons.length} lessons)
              </span>
              <span className="text-slate-400 text-sm">{openModuleId === m.id ? "−" : "+"}</span>
            </button>

            {openModuleId === m.id && (
              <div className="mt-4 space-y-3">
                {m.lessons.map((l) => (
                  <div key={l.id} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-700">{l.title}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.content}</p>
                  </div>
                ))}

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Add a lesson</p>
                  <input
                    placeholder="Lesson title"
                    value={lessonForms[m.id]?.title || ""}
                    onChange={(e) =>
                      setLessonForms({
                        ...lessonForms,
                        [m.id]: { ...lessonForms[m.id], title: e.target.value, content: lessonForms[m.id]?.content || "", videoUrl: lessonForms[m.id]?.videoUrl || "" },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  <textarea
                    placeholder="Lesson content (text)"
                    value={lessonForms[m.id]?.content || ""}
                    onChange={(e) =>
                      setLessonForms({
                        ...lessonForms,
                        [m.id]: { ...lessonForms[m.id], content: e.target.value, title: lessonForms[m.id]?.title || "", videoUrl: lessonForms[m.id]?.videoUrl || "" },
                      })
                    }
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  <input
                    placeholder="Video URL (optional)"
                    value={lessonForms[m.id]?.videoUrl || ""}
                    onChange={(e) =>
                      setLessonForms({
                        ...lessonForms,
                        [m.id]: { ...lessonForms[m.id], videoUrl: e.target.value, title: lessonForms[m.id]?.title || "", content: lessonForms[m.id]?.content || "" },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  />
                  <button
                    onClick={() => addLesson(m.id)}
                    className="bg-mega-navy text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition"
                  >
                    Add Lesson
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border border-dashed border-slate-300 rounded-xl p-5 flex items-center gap-3">
        <input
          placeholder="New module title (e.g. Introduction)"
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
        <button
          onClick={addModule}
          className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition whitespace-nowrap"
        >
          + Add Module
        </button>
      </div>
    </div>
  );
}
