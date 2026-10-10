// Mirrors docs/DATA_MODEL.md. The local store uses these shapes so the
// Supabase-backed store can drop in without touching the UI.

export type Role = "owner" | "parent" | "kid";

export interface Member {
  id: string;
  role: Role;
  displayName: string;
  birthdate?: string;
  color: string;
  /** Data URL (local preview) or storage path (Supabase). */
  avatarUrl?: string;
  avatarEmoji?: string;
  /** SHA-256 hex of the parent PIN. Parents only. */
  pinHash?: string;
  email?: string;
}

export type TimeWindow = "morning" | "after_school" | "bedtime";

export interface RoutineStep {
  id: string;
  title: string;
  icon: string;
}

export interface Routine {
  id: string;
  memberId: string;
  name: string;
  timeWindow: TimeWindow;
  starReward: number;
  steps: RoutineStep[];
}

export type TaskStatus = "todo" | "pending" | "approved" | "rejected";

export interface TaskInstance {
  /** `${dueDate}:${memberId}:${stepId}` */
  id: string;
  memberId: string;
  routineId: string;
  stepId: string;
  dueDate: string;
  status: TaskStatus;
  completedAt?: string;
  approvedBy?: string;
}

export interface StarLedgerEntry {
  id: string;
  memberId: string;
  delta: number;
  kind: "earn" | "spend" | "adjust";
  refType: "routine" | "chore" | "reward" | "manual";
  refId: string;
  createdBy: string;
  createdAt: string;
}

export interface WindowRange {
  start: string; // "HH:MM"
  end: string;
}

export interface FamilySettings {
  togetherWindows: Record<TimeWindow, WindowRange>;
  autoSwitchToTogether: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  calendar: string;
  color: string;
  start: string; // "HH:MM" today
  end?: string;
  allDay?: boolean;
  memberIds: string[];
}

export interface FamilyState {
  version: number;
  familyName: string;
  ownerMemberId: string;
  members: Member[];
  routines: Routine[];
  tasks: Record<string, TaskInstance>;
  ledger: StarLedgerEntry[];
  settings: FamilySettings;
  dinnerToday: string;
  eventsToday: CalendarEvent[];
}
