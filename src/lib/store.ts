"use client";

// Local-first store for the preview. Persists to localStorage and exposes the
// same actions the Supabase-backed store will implement in Phase 1b.

import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import { todayKey } from "./time";
import type { FamilyState, Member, Routine, StarLedgerEntry, TaskInstance } from "./types";

const STORAGE_KEY = "haagie-hq:v1";

let state: FamilyState = createSeed();
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FamilyState;
      if (parsed.version === state.version) state = parsed;
    }
  } catch {
    // Private mode or corrupted data: fall back to the seed.
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; the in-memory state still works.
  }
}

function setState(next: FamilyState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  // Keep multiple tabs (e.g. wall + parent phone preview) in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      state = JSON.parse(e.newValue);
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFamily(): FamilyState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => state,
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const taskId = (date: string, memberId: string, stepId: string) => `${date}:${memberId}:${stepId}`;

// ---------- selectors ----------

export function starBalance(s: FamilyState, memberId: string): number {
  return s.ledger.filter((e) => e.memberId === memberId).reduce((sum, e) => sum + e.delta, 0);
}

export function taskFor(s: FamilyState, date: string, memberId: string, stepId: string): TaskInstance | undefined {
  return s.tasks[taskId(date, memberId, stepId)];
}

export function routineProgress(s: FamilyState, routine: Routine, date = todayKey()) {
  const done = routine.steps.filter((st) => {
    const t = taskFor(s, date, routine.memberId, st.id);
    return t && (t.status === "pending" || t.status === "approved");
  }).length;
  return { done, total: routine.steps.length, complete: done === routine.steps.length };
}

export function routineAwarded(s: FamilyState, routine: Routine, date = todayKey()) {
  return s.ledger.some((e) => e.refType === "routine" && e.refId === `${date}:${routine.id}`);
}

export function pendingTasks(s: FamilyState): TaskInstance[] {
  return Object.values(s.tasks).filter((t) => t.status === "pending");
}

export const kids = (s: FamilyState) => s.members.filter((m) => m.role === "kid");
export const parents = (s: FamilyState) => s.members.filter((m) => m.role !== "kid");

// ---------- actions ----------

/** Kiosk action: kid taps a step. todo -> pending, pending -> todo (undo). Approved is locked. */
export function toggleStep(memberId: string, routineId: string, stepId: string, date = todayKey()) {
  const id = taskId(date, memberId, stepId);
  const existing = state.tasks[id];
  if (existing?.status === "approved") return;
  const next: TaskInstance =
    existing?.status === "pending"
      ? { ...existing, status: "todo", completedAt: undefined }
      : { id, memberId, routineId, stepId, dueDate: date, status: "pending", completedAt: new Date().toISOString() };
  setState({ ...state, tasks: { ...state.tasks, [id]: next } });
}

/** Parent action: approve pending tasks, then award stars for any routine that is now fully approved. */
export function approveTasks(ids: string[], parentId: string) {
  const tasks = { ...state.tasks };
  for (const id of ids) {
    const t = tasks[id];
    if (t?.status === "pending") tasks[id] = { ...t, status: "approved", approvedBy: parentId };
  }
  const ledger: StarLedgerEntry[] = [...state.ledger];
  const touched = new Set(ids.map((id) => tasks[id]).filter(Boolean).map((t) => `${t.dueDate}|${t.routineId}`));
  for (const key of touched) {
    const [date, routineId] = key.split("|");
    const routine = state.routines.find((r) => r.id === routineId);
    if (!routine) continue;
    const allApproved = routine.steps.every((st) => tasks[taskId(date, routine.memberId, st.id)]?.status === "approved");
    const refId = `${date}:${routine.id}`;
    if (allApproved && !ledger.some((e) => e.refType === "routine" && e.refId === refId)) {
      ledger.push({
        id: uid(),
        memberId: routine.memberId,
        delta: routine.starReward,
        kind: "earn",
        refType: "routine",
        refId,
        createdBy: parentId,
        createdAt: new Date().toISOString(),
      });
    }
  }
  setState({ ...state, tasks, ledger });
}

export function rejectTasks(ids: string[], parentId: string) {
  const tasks = { ...state.tasks };
  for (const id of ids) {
    const t = tasks[id];
    if (t?.status === "pending") tasks[id] = { ...t, status: "todo", completedAt: undefined, approvedBy: parentId };
  }
  setState({ ...state, tasks });
}

export function updateMember(id: string, patch: Partial<Member>) {
  setState({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

export function updateSettings(patch: Partial<FamilyState["settings"]>) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

export function resetPreviewData() {
  setState(createSeed());
}
