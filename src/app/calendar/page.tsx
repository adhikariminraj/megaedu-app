import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const events = await prisma.event.findMany({
    where: { startsAt: { gte: new Date() } },
    include: { school: true, organization: true },
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  // Group by month for a simple, readable bulletin-style layout.
  const grouped = events.reduce<Record<string, typeof events>>((acc, e) => {
    const key = new Date(e.startsAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Calendar</h1>
      <p className="text-slate-500 mb-10">
        Upcoming events from schools and organizations across the network.
      </p>

      {events.length === 0 ? (
        <p className="text-slate-400">
          No upcoming events yet. Schools and organizations can post events
          from their dashboard.
        </p>
      ) : (
        Object.entries(grouped).map(([month, monthEvents]) => (
          <div key={month} className="mb-10">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
              {month}
            </h2>
            <div className="space-y-3">
              {monthEvents.map((e) => (
                <div key={e.id} className="border border-slate-200 rounded-xl p-5 flex gap-4">
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-2xl font-bold text-mega-navy">
                      {new Date(e.startsAt).getDate()}
                    </div>
                    <div className="text-xs text-slate-400 uppercase">
                      {new Date(e.startsAt).toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{e.title}</p>
                    {e.description && (
                      <p className="text-sm text-slate-500 mt-1">{e.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      {e.school?.name || e.organization?.name}
                      {e.location ? ` · ${e.location}` : ""}
                      {e.onlineUrl ? " · Online" : ""}
                      {" · "}
                      {new Date(e.startsAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
