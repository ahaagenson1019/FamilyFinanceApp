"use client";

// One store, two backends:
//  - "supabase": the real thing. Loads the family the signed-in parent or
//    paired wall device belongs to, keeps it fresh over realtime, and sends
//    every change through the RPCs in supabase/migrations.
//  - "local": sample data in localStorage, for offline previews.
// The UI only ever talks to the selectors and actions exported here.

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSeed } from "./seed";
import { DATA_MODE, supabase } from "./supabase";
import { sha256Hex } from "./image";
import { todayKey } from "./time";
import type { FamilySettings, FamilyState, Member, Routine, StarLedgerEntry, TaskInstance, TimeWindow } from "./types";

const STORAGE_KEY = "haagie-hq:v1";

const blank = (): FamilyState => ({
  ...createSeed(),
  status: "loading",
  viewer: null,
  members: [],
  routines: [],
  tasks: {},
  ledger: [],
  eventsToday: [],
  dinnerToday: "",
});

let state: FamilyState = DATA_MODE === "local" ? createSeed() : blank();
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: FamilyState) {
  state = next;
  if (DATA_MODE === "local") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; in-memory state still works.
    }
  }
  emit();
}

const patch = (p: Partial<FamilyState>) => setState({ ...state, ...p });

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (DATA_MODE === "local") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FamilyState;
        if (parsed.version === state.version) state = { ...parsed, status: "ready", viewer: { kind: "local" } };
      }
    } catch {
      // Fall back to the seed.
    }
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        state = JSON.parse(e.newValue);
        emit();
      }
    });
    return;
  }
  supabase().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") void loadRemote();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFamily(): FamilyState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const taskId = (date: string, memberId: string, stepId: string) => `${date}:${memberId}:${stepId}`;

// ---------------------------------------------------------------------------
// Supabase loading
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null;
let loadSeq = 0;

interface MemberRow {
  id: string;
  role: Member["role"];
  display_name: string;
  color: string;
  avatar_path: string | null;
  avatar_emoji: string | null;
  email: string | null;
  sort: number;
}

async function loadRemote() {
  const seq = ++loadSeq;
  const sb = supabase();
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    channel?.unsubscribe();
    channel = null;
    return patch({ ...blank(), status: "signed_out" });
  }

  try {
    // A wall device first, otherwise a parent (claiming their member row by email on first sign-in).
    const { data: device } = await sb.from("devices").select("id, family_id, name").eq("auth_user_id", session.user.id).maybeSingle();
    let familyId: string | undefined;
    let viewer: FamilyState["viewer"] = null;
    if (device) {
      familyId = device.family_id;
      viewer = { kind: "device", deviceId: device.id, name: device.name };
    } else if (session.user.is_anonymous) {
      return patch({ ...blank(), status: "unpaired" });
    } else {
      const { data: me, error } = await sb.rpc("claim_membership");
      if (error) throw error;
      if (!me?.id) return patch({ ...blank(), status: "not_member", viewer: null, error: session.user.email ?? undefined });
      familyId = me.family_id;
      viewer = { kind: "parent", memberId: me.id, email: session.user.email ?? "" };
    }
    if (!familyId) return;

    await refreshAll(familyId, viewer);
    if (seq !== loadSeq) return;
    subscribeRealtime(familyId);
  } catch (e) {
    patch({ status: "error", error: (e as Error).message });
  }
}

async function refreshAll(familyId: string, viewer = state.viewer) {
  const sb = supabase();
  const today = todayKey();
  const [fam, members, settings, routines, tasks, ledger, pins] = await Promise.all([
    sb.from("families").select("name, owner_member_id").eq("id", familyId).single(),
    sb.from("members").select("id, role, display_name, color, avatar_path, avatar_emoji, email, sort").eq("family_id", familyId).order("sort"),
    sb.from("family_settings").select("together_windows, auto_switch_to_together, dinner_today").eq("family_id", familyId).single(),
    sb.from("routines").select("id, member_id, name, time_window, star_reward, routine_steps(id, position, title, icon)").eq("family_id", familyId).eq("active", true),
    sb.from("task_instances").select("id, member_id, routine_id, step_id, due_date, status, completed_at, approved_by").eq("family_id", familyId).or(`due_date.eq.${today},status.eq.pending`),
    sb.from("star_ledger").select("id, member_id, delta, kind, ref_type, ref_id, created_by, created_at").eq("family_id", familyId),
    sb.rpc("parents_with_pin", { fid: familyId }),
  ]);
  for (const r of [fam, members, settings, routines, tasks, ledger, pins]) if (r.error) throw r.error;

  const withPin = new Set<string>((pins.data as string[]) ?? []);
  const memberRows = members.data as MemberRow[];
  const signed = await signAvatars(memberRows.map((m) => m.avatar_path).filter((p): p is string => !!p));

  setState({
    ...state,
    status: "ready",
    viewer,
    familyId,
    error: undefined,
    familyName: fam.data!.name,
    ownerMemberId: fam.data!.owner_member_id,
    members: memberRows.map((m) => ({
      id: m.id,
      role: m.role,
      displayName: m.display_name,
      color: m.color,
      avatarPath: m.avatar_path ?? undefined,
      avatarUrl: m.avatar_path ? signed[m.avatar_path] : undefined,
      avatarEmoji: m.avatar_emoji ?? undefined,
      email: m.email ?? undefined,
      hasPin: withPin.has(m.id),
    })),
    routines: (routines.data as RoutineRow[]).map(toRoutine),
    tasks: Object.fromEntries((tasks.data as TaskRow[]).map((t) => [taskId(t.due_date, t.member_id, t.step_id), toTask(t)])),
    ledger: (ledger.data as LedgerRow[]).map(toLedger),
    settings: {
      togetherWindows: settings.data!.together_windows as FamilySettings["togetherWindows"],
      autoSwitchToTogether: settings.data!.auto_switch_to_together,
    },
    dinnerToday: settings.data!.dinner_today ?? "",
    // Real calendar sync arrives in Phase 3.
    eventsToday: [],
  });
}

const avatarCache: Record<string, string> = {};
async function signAvatars(paths: string[]): Promise<Record<string, string>> {
  const missing = paths.filter((p) => !avatarCache[p]);
  if (missing.length) {
    const { data } = await supabase().storage.from("avatars").createSignedUrls(missing, 60 * 60 * 24);
    for (const d of data ?? []) if (d.signedUrl && d.path) avatarCache[d.path] = d.signedUrl;
  }
  return avatarCache;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (state.familyId) void refreshAll(state.familyId).catch(() => {});
  }, 250);
}

function subscribeRealtime(familyId: string) {
  channel?.unsubscribe();
  const filter = `family_id=eq.${familyId}`;
  channel = supabase().channel(`family:${familyId}`);
  for (const table of ["task_instances", "star_ledger", "members", "family_settings"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, scheduleRefresh);
  }
  channel.subscribe();
}

// Re-sync after the tablet wakes up or the day rolls over.
if (typeof window !== "undefined" && DATA_MODE === "supabase") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && scheduleRefresh());
  setInterval(scheduleRefresh, 5 * 60 * 1000);
}

interface RoutineRow {
  id: string;
  member_id: string;
  name: string;
  time_window: TimeWindow;
  star_reward: number;
  routine_steps: { id: string; position: number; title: string; icon: string }[];
}
const toRoutine = (r: RoutineRow): Routine => ({
  id: r.id,
  memberId: r.member_id,
  name: r.name,
  timeWindow: r.time_window,
  starReward: r.star_reward,
  steps: [...r.routine_steps].sort((a, b) => a.position - b.position).map((s) => ({ id: s.id, title: s.title, icon: s.icon })),
});

interface TaskRow {
  id: string;
  member_id: string;
  routine_id: string;
  step_id: string;
  due_date: string;
  status: TaskInstance["status"];
  completed_at: string | null;
  approved_by: string | null;
}
const toTask = (t: TaskRow): TaskInstance => ({
  id: taskId(t.due_date, t.member_id, t.step_id),
  dbId: t.id,
  memberId: t.member_id,
  routineId: t.routine_id,
  stepId: t.step_id,
  dueDate: t.due_date,
  status: t.status,
  completedAt: t.completed_at ?? undefined,
  approvedBy: t.approved_by ?? undefined,
});

interface LedgerRow {
  id: string;
  member_id: string;
  delta: number;
  kind: StarLedgerEntry["kind"];
  ref_type: StarLedgerEntry["refType"];
  ref_id: string;
  created_by: string | null;
  created_at: string;
}
const toLedger = (e: LedgerRow): StarLedgerEntry => ({
  id: e.id,
  memberId: e.member_id,
  delta: e.delta,
  kind: e.kind,
  refType: e.ref_type,
  refId: e.ref_id,
  createdBy: e.created_by ?? "",
  createdAt: e.created_at,
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

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
  return { done, total: routine.steps.length, complete: routine.steps.length > 0 && done === routine.steps.length };
}

export function routineAwarded(s: FamilyState, routine: Routine, date = todayKey()) {
  return s.ledger.some((e) => e.refType === "routine" && e.refId === `${date}:${routine.id}`);
}

export function pendingTasks(s: FamilyState): TaskInstance[] {
  return Object.values(s.tasks).filter((t) => t.status === "pending");
}

export const kids = (s: FamilyState) => s.members.filter((m) => m.role === "kid");
export const parents = (s: FamilyState) => s.members.filter((m) => m.role !== "kid");

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function reportError(e: unknown) {
  console.error(e);
  patch({ error: (e as Error)?.message ?? "Something went wrong" });
  scheduleRefresh();
}

/** Kid taps a step. todo -> pending, pending -> todo (undo). Approved is locked. Optimistic. */
export function toggleStep(memberId: string, routineId: string, stepId: string, date = todayKey()) {
  const id = taskId(date, memberId, stepId);
  const existing = state.tasks[id];
  if (existing?.status === "approved") return;
  const next: TaskInstance =
    existing?.status === "pending"
      ? { ...existing, status: "todo", completedAt: undefined }
      : { ...existing, id, memberId, routineId, stepId, dueDate: date, status: "pending", completedAt: new Date().toISOString() };
  setState({ ...state, tasks: { ...state.tasks, [id]: next } });

  if (DATA_MODE === "local") return;
  supabase()
    .rpc("toggle_step", { p_member_id: memberId, p_step_id: stepId, p_date: date })
    .then(({ data, error }) => {
      if (error) return reportError(error);
      const row = data as TaskRow;
      setState({ ...state, tasks: { ...state.tasks, [id]: toTask(row) } });
    });
}

/** Parent approves pending tasks; routines that become fully approved pay out stars. */
export async function approveTasks(ids: string[], parentId: string) {
  if (DATA_MODE === "local") return approveLocal(ids, parentId);
  const dbIds = ids.map((id) => state.tasks[id]?.dbId).filter((x): x is string => !!x);
  const tasks = { ...state.tasks };
  for (const id of ids) if (tasks[id]?.status === "pending") tasks[id] = { ...tasks[id], status: "approved", approvedBy: parentId };
  patch({ tasks });
  const { error } = await supabase().rpc("approve_tasks", { p_task_ids: dbIds });
  if (error) return reportError(error);
  scheduleRefresh();
}

export async function rejectTasks(ids: string[], parentId: string) {
  const tasks = { ...state.tasks };
  for (const id of ids) {
    const t = tasks[id];
    if (t?.status === "pending") tasks[id] = { ...t, status: "todo", completedAt: undefined, approvedBy: parentId };
  }
  patch({ tasks });
  if (DATA_MODE === "local") return;
  const dbIds = ids.map((id) => state.tasks[id]?.dbId).filter((x): x is string => !!x);
  const { error } = await supabase().rpc("reject_tasks", { p_task_ids: dbIds });
  if (error) reportError(error);
}

function approveLocal(ids: string[], parentId: string) {
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
      ledger.push({ id: uid(), memberId: routine.memberId, delta: routine.starReward, kind: "earn", refType: "routine", refId, createdBy: parentId, createdAt: new Date().toISOString() });
    }
  }
  setState({ ...state, tasks, ledger });
}

export async function setMemberColor(id: string, color: string) {
  setState({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, color } : m)) });
  if (DATA_MODE === "local") return;
  const { error } = await supabase().rpc("update_member_look", { p_member_id: id, p_color: color });
  if (error) reportError(error);
}

/** Saves a cropped avatar (data URL) or clears it when `dataUrl` is empty. */
export async function setMemberPhoto(id: string, dataUrl: string) {
  const local = () => setState({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, avatarUrl: dataUrl || undefined } : m)) });
  if (DATA_MODE === "local") return local();
  const sb = supabase();
  if (!dataUrl) {
    local();
    const { error } = await sb.rpc("update_member_look", { p_member_id: id, p_clear_avatar: true });
    return error && reportError(error);
  }
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${state.familyId}/${id}-${Date.now()}.webp`;
  const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false });
  if (up.error) return reportError(up.error);
  avatarCache[path] = dataUrl;
  setState({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, avatarUrl: dataUrl, avatarPath: path } : m)) });
  const { error } = await sb.rpc("update_member_look", { p_member_id: id, p_avatar_path: path });
  if (error) reportError(error);
}

export async function updateSettings(p: Partial<FamilySettings>) {
  setState({ ...state, settings: { ...state.settings, ...p } });
  if (DATA_MODE === "local" || !state.familyId) return;
  const { error } = await supabase().rpc("update_family_settings", {
    p_family_id: state.familyId,
    p_together_windows: p.togetherWindows ?? null,
    p_auto_switch: p.autoSwitchToTogether ?? null,
  });
  if (error) reportError(error);
}

/** Checks a parent PIN. Returns the unlock expiry, or null if wrong. Throws on lockout. */
export async function verifyPin(memberId: string, pin: string): Promise<number | null> {
  if (DATA_MODE === "local") {
    const m = state.members.find((x) => x.id === memberId);
    return m && (await sha256Hex(pin)) === m.pinHash ? Date.now() + 5 * 60 * 1000 : null;
  }
  const { data, error } = await supabase().rpc("verify_parent_pin", { p_member_id: memberId, p_pin: pin });
  if (error) throw new Error(error.message);
  return data ? new Date(data as string).getTime() : null;
}

export async function setPin(memberId: string, pin: string) {
  if (DATA_MODE === "local") {
    const pinHash = await sha256Hex(pin);
    return setState({ ...state, members: state.members.map((m) => (m.id === memberId ? { ...m, pinHash, hasPin: true } : m)) });
  }
  const { error } = await supabase().rpc("set_parent_pin", { p_member_id: memberId, p_pin: pin });
  if (error) throw new Error(error.message);
  setState({ ...state, members: state.members.map((m) => (m.id === memberId ? { ...m, hasPin: true } : m)) });
}

export async function lockDevice() {
  if (DATA_MODE === "local" || state.viewer?.kind !== "device") return;
  await supabase().rpc("lock_device");
}

export async function createPairingCode(): Promise<string> {
  const { data, error } = await supabase().rpc("create_pairing_code");
  if (error) throw new Error(error.message);
  return data as string;
}

export async function pairThisDevice(code: string, name: string) {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw new Error(error.message.includes("Anonymous") ? "Wall pairing isn't switched on in Supabase yet (Allow anonymous sign-ins)." : error.message);
  }
  const { error } = await sb.rpc("pair_device", { p_code: code, p_name: name });
  if (error) throw new Error(error.message);
  await loadRemote();
}

export async function signInWithGoogle(next = "/") {
  await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
}

export async function signOut() {
  if (DATA_MODE === "local") return;
  await supabase().auth.signOut();
}

export function clearError() {
  patch({ error: undefined });
}

export function resetPreviewData() {
  if (DATA_MODE === "local") setState(createSeed());
}
