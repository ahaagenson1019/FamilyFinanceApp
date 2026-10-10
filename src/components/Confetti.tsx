"use client";

import { useMemo } from "react";

const COLORS = ["#f5b301", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316"];

/** Contained confetti burst. Clips to its positioned parent so it stays in one column. */
export function Confetti({ burstKey, pieces = 46 }: { burstKey: number; pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.6 + Math.random() * 1.2,
        drift: `${(Math.random() - 0.5) * 120}px`,
        spin: `${(Math.random() - 0.5) * 1080}deg`,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        round: Math.random() > 0.7,
      })),
    // New pieces each burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, pieces],
  );
  if (!burstKey) return null;
  return (
    <div key={burstKey} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 block motion-reduce:hidden"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.color,
              borderRadius: b.round ? "50%" : 2,
              animation: `confetti-fall ${b.duration}s cubic-bezier(.2,.6,.4,1) ${b.delay}s forwards`,
              "--drift": b.drift,
              "--spin": b.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
