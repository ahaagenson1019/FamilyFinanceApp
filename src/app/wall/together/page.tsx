"use client";

import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { useParentSession } from "@/components/ParentSession";
import { RoutineColumn } from "@/components/RoutineColumn";
import { speak } from "@/components/StepTile";
import { kids, routineProgress, useFamily } from "@/lib/store";
import { WINDOW_LABELS, WINDOW_ORDER, currentOrNextWindow, todayKey } from "@/lib/time";
import type { TimeWindow } from "@/lib/types";

export default function TogetherPage() {
  const family = useFamily();
  const { requireParent } = useParentSession();
  const [override, setOverride] = useState<TimeWindow | null>(null);
  const slot = override ?? currentOrNextWindow(family.settings);
  const date = todayKey();

  const columns = kids(family)
    .map((kid) => ({ kid, routine: family.routines.find((r) => r.memberId === kid.id && r.timeWindow === slot) }))
    .filter((c): c is { kid: (typeof c)["kid"]; routine: NonNullable<(typeof c)["routine"]> } => !!c.routine);

  const allDone = columns.length > 0 && columns.every((c) => routineProgress(family, c.routine, date).complete);
  const [celebrate, setCelebrate] = useState(0);
  const wasAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasAllDone.current) {
      setCelebrate((c) => c + 1);
      speak("Everybody's ready!");
    }
    wasAllDone.current = allDone;
  }, [allDone]);

  const range = family.settings.togetherWindows[slot];

  return (
    <div className="relative flex h-full flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">Let&apos;s do it together</p>
          <h1 className="font-display text-4xl font-semibold md:text-5xl">{WINDOW_LABELS[slot]} routine</h1>
        </div>
        <div className="flex gap-1 rounded-full bg-card p-1 shadow-soft" role="tablist" aria-label="Routine">
          {WINDOW_ORDER.map((w) => (
            <button
              key={w}
              role="tab"
              aria-selected={w === slot}
              onClick={() => w !== slot && requireParent(() => setOverride(w))}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                w === slot ? "bg-ink text-white" : "text-ink-soft"
              }`}
            >
              {w !== slot && "🔒 "}
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </header>
      <p className="-mt-2 text-sm text-ink-soft">
        {range.start}–{range.end} · Hold any picture to hear it read out loud
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4 xl:overflow-hidden">
        {columns.map(({ kid, routine }) => (
          <RoutineColumn key={`${kid.id}-${routine.id}`} member={kid} routine={routine} />
        ))}
      </div>

      {celebrate > 0 && allDone && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-ink/30 backdrop-blur-[2px]"
          onClick={() => setCelebrate(0)}
        >
          <Confetti burstKey={celebrate} pieces={140} />
          <div className="animate-rise rounded-[32px] bg-card px-12 py-10 text-center shadow-soft">
            <div className="text-7xl">🎉</div>
            <h2 className="mt-3 font-display text-5xl font-semibold">Everybody&apos;s ready!</h2>
            <p className="mt-2 text-lg text-ink-soft">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
