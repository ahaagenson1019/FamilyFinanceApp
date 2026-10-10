"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Clock } from "@/components/Clock";
import { kids, routineProgress, starBalance, useFamily } from "@/lib/store";
import { WINDOW_LABELS, activeWindow, chicagoMinutes, currentOrNextWindow, formatClock } from "@/lib/time";

export default function WallHome() {
  const family = useFamily();
  const active = activeWindow(family.settings);
  const slot = currentOrNextWindow(family.settings);
  const nowMins = chicagoMinutes();
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  return (
    <div className="grid h-full grid-cols-1 gap-5 overflow-y-auto p-4 md:p-6 lg:grid-cols-[minmax(340px,0.9fr)_1.5fr] lg:overflow-hidden">
      {/* Left: time, agenda, dinner */}
      <div className="flex flex-col gap-5 lg:min-h-0">
        <div className="px-1">
          <p className="font-display text-lg font-semibold text-accent">Haagie Headquarters</p>
          <Clock />
        </div>

        <section className="flex flex-col rounded-[28px] bg-card p-5 shadow-soft lg:min-h-0 lg:flex-1">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">Today</h2>
            {family.eventsToday.length > 0 && family.viewer?.kind === "local" && (
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Sample events</span>
            )}
          </div>
          {family.eventsToday.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-ink-soft">
              <span className="text-5xl">📅</span>
              <p className="font-bold">Your Google Calendars show up here once calendar sync is on (Phase 3).</p>
            </div>
          )}
          <ul className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
            {family.eventsToday.map((e) => {
              const past = e.end ? toMins(e.end) <= nowMins : toMins(e.start) < nowMins - 60;
              const tagged = family.members.filter((m) => e.memberIds.includes(m.id));
              return (
                <li key={e.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${past ? "opacity-45" : ""}`}>
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                  <div className="w-16 shrink-0 text-sm font-bold text-ink-soft">{formatClock(e.start)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold">{e.title}</div>
                    <div className="truncate text-xs text-ink-soft">{e.calendar}</div>
                  </div>
                  <div className="flex -space-x-2">
                    {tagged.map((m) => (
                      <Avatar key={m.id} member={m} size={30} ring={false} className="border-2 border-card" />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {family.dinnerToday && <section className="flex items-center gap-4 rounded-[28px] bg-card px-5 py-4 shadow-soft">
          <span className="text-4xl">🍽️</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Dinner tonight</p>
            <p className="font-display text-2xl font-semibold">{family.dinnerToday}</p>
          </div>
        </section>}
      </div>

      {/* Right: kids */}
      <div className="flex flex-col gap-4 lg:min-h-0">
        <Link
          href="/wall/together"
          className="flex items-center justify-between gap-4 rounded-[28px] px-6 py-5 text-white shadow-soft"
          style={{ background: active ? "var(--accent)" : "var(--ink)" }}
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">
              {active ? "Happening now" : `Up next · ${formatClock(family.settings.togetherWindows[slot].start)}`}
            </p>
            <p className="font-display text-3xl font-semibold">{WINDOW_LABELS[slot]} routine</p>
          </div>
          <span className="rounded-full bg-white/15 px-5 py-3 text-lg font-bold">Everybody go! →</span>
        </Link>

        <div className="grid flex-1 grid-cols-2 gap-4 lg:min-h-0">
          {kids(family).map((kid) => {
            const routine = family.routines.find((r) => r.memberId === kid.id && r.timeWindow === slot);
            const p = routine ? routineProgress(family, routine) : null;
            return (
              <Link
                key={kid.id}
                href={`/wall/kid/${kid.id}`}
                className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[28px] bg-card p-5 shadow-soft transition-transform active:scale-[0.98]"
              >
                <span className="absolute inset-x-0 top-0 h-2" style={{ background: kid.color }} />
                <Avatar member={kid} size={112} />
                <div className="text-center">
                  <div className="font-display text-3xl font-semibold">{kid.displayName}</div>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xl font-extrabold">
                    <span className="text-star">★</span> {starBalance(family, kid.id)}
                  </div>
                </div>
                {p && (
                  <div className="w-full max-w-56">
                    <div className="h-3 overflow-hidden rounded-full bg-bg-deep">
                      <div className="h-full rounded-full" style={{ width: `${(p.done / p.total) * 100}%`, background: kid.color }} />
                    </div>
                    <p className="mt-1 text-center text-sm font-bold text-ink-soft">
                      {p.complete ? "Routine done! 🎉" : `${p.done} of ${p.total} done`}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
