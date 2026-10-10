"use client";

import { useEffect, useRef, useState } from "react";
import { routineAwarded, routineProgress, starBalance, taskFor, toggleStep, useFamily } from "@/lib/store";
import { todayKey } from "@/lib/time";
import type { Member, Routine } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { StepTile, speak } from "./StepTile";

interface Props {
  member: Member;
  routine: Routine;
}

/** One kid's routine as a self-contained column. Owns its own celebration. */
export function RoutineColumn({ member, routine }: Props) {
  const family = useFamily();
  const date = todayKey();
  const { done, total, complete } = routineProgress(family, routine, date);
  const awarded = routineAwarded(family, routine, date);
  const stars = starBalance(family, member.id);

  const [burst, setBurst] = useState(0);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setBurst((b) => b + 1);
      speak(`Great job ${member.displayName}!`);
    }
    wasComplete.current = complete;
  }, [complete, member.displayName]);

  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-[28px] xl:min-h-0 bg-card shadow-soft"
      style={{ borderTop: `8px solid ${member.color}` }}
      aria-label={`${member.displayName}'s ${routine.name.toLowerCase()} routine`}
    >
      <Confetti burstKey={burst} />

      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Avatar member={member} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl font-semibold leading-none">{member.displayName}</h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-ink-soft">{routine.name}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-bg px-3 py-1.5 text-lg font-extrabold" title="Stars">
          <span className="text-star">★</span>
          {stars}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-3 xl:min-h-0 xl:overflow-y-auto">
        {routine.steps.map((step) => (
          <StepTile
            key={step.id}
            step={step}
            color={member.color}
            status={taskFor(family, date, member.id, step.id)?.status ?? "todo"}
            onToggle={() => toggleStep(member.id, routine.id, step.id, date)}
          />
        ))}
      </div>

      <footer className="px-5 pt-2 pb-5">
        {complete ? (
          <div
            className="animate-rise rounded-2xl px-4 py-3 text-center font-bold text-white"
            style={{ background: member.color }}
          >
            {awarded ? `★ +${routine.starReward} stars earned!` : `All done! +${routine.starReward} ★ when a grown-up checks`}
          </div>
        ) : (
          <>
            <div className="mb-1.5 flex justify-between text-sm font-bold text-ink-soft">
              <span>
                {done} of {total}
              </span>
              <span>+{routine.starReward} ★</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-bg-deep">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${(done / total) * 100}%`, background: member.color }}
              />
            </div>
          </>
        )}
      </footer>
    </section>
  );
}
