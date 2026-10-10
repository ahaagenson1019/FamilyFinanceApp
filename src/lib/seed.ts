import type { FamilyState, Routine, RoutineStep, TimeWindow } from "./types";

// sha256("1234"), the default preview PIN for both parents.
const DEFAULT_PIN_HASH =
  "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

const step = (id: string, title: string, icon: string): RoutineStep => ({ id, title, icon });

const MORNING_BIG = [
  step("bed", "Make bed", "🛏️"),
  step("dress", "Get dressed", "👕"),
  step("breakfast", "Eat breakfast", "🥣"),
  step("teeth", "Brush teeth", "🪥"),
  step("hair", "Brush hair", "💇"),
  step("shoes", "Shoes on", "👟"),
  step("backpack", "Backpack ready", "🎒"),
];
const MORNING_LITTLE = [
  step("dress", "Get dressed", "👕"),
  step("breakfast", "Eat breakfast", "🥣"),
  step("teeth", "Brush teeth", "🪥"),
  step("shoes", "Shoes on", "👟"),
];
const AFTER_SCHOOL_BIG = [
  step("unpack", "Unpack backpack", "🎒"),
  step("shoes", "Shoes away", "👟"),
  step("hands", "Wash hands", "🧼"),
  step("snack", "Clean up snack", "🍎"),
  step("read", "Read 15 minutes", "📖"),
];
const AFTER_SCHOOL_LITTLE = [
  step("shoes", "Shoes away", "👟"),
  step("hands", "Wash hands", "🧼"),
  step("snack", "Clean up snack", "🍎"),
];
const BEDTIME_BIG = [
  step("toys", "Toys away", "🧸"),
  step("bath", "Bath or shower", "🛁"),
  step("pjs", "Pajamas on", "🌙"),
  step("teeth", "Brush teeth", "🪥"),
  step("clothes", "Pick tomorrow's clothes", "👚"),
  step("book", "Story time", "📚"),
];
const BEDTIME_LITTLE = [
  step("toys", "Toys away", "🧸"),
  step("pjs", "Pajamas on", "🌙"),
  step("teeth", "Brush teeth", "🪥"),
  step("book", "Story time", "📚"),
];

const ROUTINE_NAMES: Record<TimeWindow, string> = {
  morning: "Morning",
  after_school: "After school",
  bedtime: "Bedtime",
};

function routinesFor(memberId: string, little: boolean): Routine[] {
  const sets: Record<TimeWindow, RoutineStep[]> = {
    morning: little ? MORNING_LITTLE : MORNING_BIG,
    after_school: little ? AFTER_SCHOOL_LITTLE : AFTER_SCHOOL_BIG,
    bedtime: little ? BEDTIME_LITTLE : BEDTIME_BIG,
  };
  return (Object.keys(sets) as TimeWindow[]).map((w) => ({
    id: `${memberId}-${w}`,
    memberId,
    name: ROUTINE_NAMES[w],
    timeWindow: w,
    starReward: little ? 2 : 3,
    steps: sets[w],
  }));
}

export function createSeed(): FamilyState {
  return {
    version: 1,
    status: "ready",
    viewer: { kind: "local" },
    familyName: "Haagie Headquarters",
    ownerMemberId: "andy",
    members: [
      { id: "andy", role: "owner", displayName: "Andy", color: "#1E3A8A", pinHash: DEFAULT_PIN_HASH, email: "andy.haagenson@gmail.com" },
      { id: "jess", role: "parent", displayName: "Jess", color: "#7E22CE", pinHash: DEFAULT_PIN_HASH, email: "jessica.haagenson@gmail.com" },
      { id: "foster", role: "kid", displayName: "Foster", color: "#2563EB" },
      { id: "ira", role: "kid", displayName: "Ira", color: "#16A34A" },
      { id: "rita", role: "kid", displayName: "Rita", color: "#EA580C" },
      { id: "enid", role: "kid", displayName: "Enid", color: "#DB2777" },
    ],
    routines: [
      ...routinesFor("foster", false),
      ...routinesFor("ira", false),
      ...routinesFor("rita", true),
      ...routinesFor("enid", true),
    ],
    tasks: {},
    ledger: [
      { id: "seed-foster", memberId: "foster", delta: 14, kind: "earn", refType: "manual", refId: "seed", createdBy: "andy", createdAt: "2026-10-01T12:00:00Z" },
      { id: "seed-ira", memberId: "ira", delta: 11, kind: "earn", refType: "manual", refId: "seed", createdBy: "andy", createdAt: "2026-10-01T12:00:00Z" },
      { id: "seed-rita", memberId: "rita", delta: 9, kind: "earn", refType: "manual", refId: "seed", createdBy: "andy", createdAt: "2026-10-01T12:00:00Z" },
      { id: "seed-enid", memberId: "enid", delta: 6, kind: "earn", refType: "manual", refId: "seed", createdBy: "andy", createdAt: "2026-10-01T12:00:00Z" },
    ],
    settings: {
      togetherWindows: {
        morning: { start: "06:45", end: "08:15" },
        after_school: { start: "15:30", end: "17:30" },
        bedtime: { start: "19:00", end: "20:15" },
      },
      autoSwitchToTogether: true,
    },
    dinnerToday: "Tacos 🌮",
    // Placeholder agenda until Google Calendar sync lands in Phase 3.
    eventsToday: [
      { id: "e1", title: "Rita swim lesson", calendar: "Haagenson Family", color: "#0EA5E9", start: "09:30", end: "10:15", memberIds: ["rita"] },
      { id: "e2", title: "Foster soccer", calendar: "Haagenson Family", color: "#0EA5E9", start: "11:00", end: "12:00", memberIds: ["foster"] },
      { id: "e3", title: "Gym open house", calendar: "andy@mplsgymnastics.com", color: "#1E3A8A", start: "13:00", end: "15:00", memberIds: ["andy"] },
      { id: "e4", title: "Ira & Enid playdate", calendar: "Jessica.haagenson@gmail.com", color: "#7E22CE", start: "16:00", end: "17:30", memberIds: ["ira", "enid"] },
      { id: "e5", title: "Family movie night", calendar: "Haagenson Family", color: "#0EA5E9", start: "18:30", memberIds: [] },
    ],
  };
}
