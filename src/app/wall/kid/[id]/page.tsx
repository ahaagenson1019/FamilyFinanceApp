"use client";

import Link from "next/link";
import { use } from "react";
import { Avatar } from "@/components/Avatar";
import { StepTile } from "@/components/StepTile";
import { routineProgress, starBalance, taskFor, toggleStep, useFamily } from "@/lib/store";
import { WINDOW_LABELS, currentOrNextWindow, todayKey } from "@/lib/time";

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const family = useFamily();
  const kid = family.members.find((m) => m.id === id && m.role === "kid");
  if (!kid) return <p className="p-8">Not found</p>;

  const slot = currentOrNextWindow(family.settings);
  const routine = family.routines.find((r) => r.memberId === kid.id && r.timeWindow === slot);
  const date = todayKey();
  const p = routine ? routineProgress(family, routine, date) : null;

  return (
    <div className="grid h-full grid-cols-1 gap-5 overflow-y-auto p-4 md:p-6 lg:grid-cols-[1fr_1.4fr] lg:overflow-hidden">
      <div className="flex flex-col gap-5">
        <Link href="/wall" className="self-start rounded-full bg-card px-4 py-2 font-bold text-ink-soft shadow-soft">
          ← Home
        </Link>
        <section className="flex flex-col items-center gap-4 rounded-[28px] bg-card p-8 shadow-soft" style={{ borderTop: `10px solid ${kid.color}` }}>
          <Avatar member={kid} size={180} />
          <h1 className="font-display text-6xl font-semibold">{kid.displayName}</h1>
          <div className="flex items-center gap-2 rounded-full bg-bg px-6 py-3 text-3xl font-extrabold">
            <span className="text-star">★</span> {starBalance(family, kid.id)} stars
          </div>
        </section>
        <section className="rounded-[28px] border-2 border-dashed border-line p-5 text-center text-ink-soft">
          <p className="text-3xl">🎯 💰</p>
          <p className="mt-1 font-bold">Star goals and My Money (Greenlight) jars arrive in Phase 2</p>
        </section>
      </div>

      {routine && p && (
        <section className="flex flex-col rounded-[28px] bg-card p-5 shadow-soft lg:min-h-0">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold">{WINDOW_LABELS[slot]} routine</h2>
            <span className="text-lg font-bold text-ink-soft">
              {p.done} of {p.total}
            </span>
          </div>
          <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
            {routine.steps.map((step) => (
              <StepTile
                key={step.id}
                size="lg"
                step={step}
                color={kid.color}
                status={taskFor(family, date, kid.id, step.id)?.status ?? "todo"}
                onToggle={() => toggleStep(kid.id, routine.id, step.id, date)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
