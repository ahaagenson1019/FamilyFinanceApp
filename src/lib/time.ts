import type { FamilySettings, TimeWindow } from "./types";

export const WINDOW_ORDER: TimeWindow[] = ["morning", "after_school", "bedtime"];

export const WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: "Morning",
  after_school: "After school",
  bedtime: "Bedtime",
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Date key in the family's timezone (America/Chicago). */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function chicagoMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** The routine window happening right now, if any. */
export function activeWindow(settings: FamilySettings, now = new Date()): TimeWindow | null {
  const mins = chicagoMinutes(now);
  for (const w of WINDOW_ORDER) {
    const r = settings.togetherWindows[w];
    if (mins >= toMinutes(r.start) && mins < toMinutes(r.end)) return w;
  }
  return null;
}

/** The current window, or else the next one coming up today (bedtime after it ends). */
export function currentOrNextWindow(settings: FamilySettings, now = new Date()): TimeWindow {
  const active = activeWindow(settings, now);
  if (active) return active;
  const mins = chicagoMinutes(now);
  for (const w of WINDOW_ORDER) {
    if (mins < toMinutes(settings.togetherWindows[w].start)) return w;
  }
  return "bedtime";
}

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}
