"use client";

import { useRef } from "react";
import type { RoutineStep, TaskStatus } from "@/lib/types";

const LONG_PRESS_MS = 450;

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1.1;
  // speechSynthesis queues utterances, so simultaneous long-presses take turns.
  window.speechSynthesis.speak(u);
}

interface Props {
  step: RoutineStep;
  status: TaskStatus;
  color: string;
  onToggle: () => void;
  size?: "md" | "lg";
}

/**
 * One routine step. Handles its own pointer lifecycle (tap = toggle,
 * long-press = read aloud) with no shared state, so any number of tiles can
 * be pressed at the same time on a multi-touch screen.
 */
export function StepTile({ step, status, color, onToggle, size = "md" }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const done = status === "pending" || status === "approved";
  const locked = status === "approved";

  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={`${step.title}${done ? ", done" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        longPressed.current = false;
        timer.current = setTimeout(() => {
          longPressed.current = true;
          speak(step.title);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={(e) => {
        if (e.pointerId !== pointer.current) return;
        pointer.current = null;
        clear();
        if (!longPressed.current && !locked) onToggle();
      }}
      onPointerCancel={() => {
        pointer.current = null;
        clear();
      }}
      onPointerLeave={(e) => {
        if (e.pointerId !== pointer.current) return;
        pointer.current = null;
        clear();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !locked) {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`group relative flex w-full items-center gap-4 rounded-2xl border-2 text-left transition-colors duration-150 ${
        size === "lg" ? "min-h-24 px-5 py-4" : "min-h-[76px] px-4 py-3"
      } ${done ? "animate-pop" : ""}`}
      style={{
        borderColor: done ? color : "var(--line)",
        background: done ? `color-mix(in srgb, ${color} ${locked ? 22 : 12}%, var(--card))` : "var(--card)",
      }}
    >
      <span className={`${size === "lg" ? "text-5xl" : "text-4xl"} leading-none`} aria-hidden>
        {step.icon}
      </span>
      <span
        className={`flex-1 font-bold leading-tight ${size === "lg" ? "text-2xl" : "text-xl"} ${done ? "text-ink-soft" : ""}`}
      >
        {step.title}
      </span>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] text-2xl font-black text-white transition-all"
        style={{
          borderColor: done ? color : "var(--line)",
          background: done ? color : "transparent",
        }}
        aria-hidden
      >
        {locked ? "★" : done ? "✓" : ""}
      </span>
    </button>
  );
}
