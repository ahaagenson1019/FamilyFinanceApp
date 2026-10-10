"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";
import { Gate } from "@/components/Gate";
import { useParentSession } from "@/components/ParentSession";
import {
  approveTasks,
  createPairingCode,
  kids,
  parents,
  pendingTasks,
  rejectTasks,
  resetPreviewData,
  setMemberColor,
  setMemberPhoto,
  setPin,
  signOut,
  updateSettings,
  useFamily,
} from "@/lib/store";
import { DATA_MODE } from "@/lib/supabase";
import { WINDOW_LABELS, WINDOW_ORDER } from "@/lib/time";
import type { Member } from "@/lib/types";

type Tab = "approvals" | "family" | "settings";

export default function ParentPage() {
  return (
    <Suspense>
      <Gate next="/parent">
        <ParentArea />
      </Gate>
    </Suspense>
  );
}

function ParentArea() {
  const family = useFamily();
  const router = useRouter();
  const search = useSearchParams();
  const { parentId, requireParent, lock } = useParentSession();
  const [tab, setTab] = useState<Tab>("approvals");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !parentId) requireParent();
  }, [mounted, parentId, requireParent]);

  const back = search.get("from") ?? "/wall";
  const me = family.members.find((m) => m.id === parentId);

  if (!mounted) return null;
  if (!me) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="font-display text-3xl font-semibold">Grown-ups only</h1>
        <div className="flex gap-3">
          <button onClick={() => requireParent()} className="rounded-full bg-ink px-6 py-3 font-bold text-white">
            Enter PIN
          </button>
          <Link href="/wall" className="rounded-full bg-card px-6 py-3 font-bold shadow-soft">
            Back to wall
          </Link>
        </div>
      </div>
    );
  }

  const pending = pendingTasks(family);
  const signedIn = family.viewer?.kind === "parent";

  return (
    <div className="mx-auto min-h-dvh max-w-3xl p-4 md:p-8">
      <header className="mb-6 flex items-center gap-3">
        <Avatar member={me} size={52} />
        <div className="flex-1">
          <p className="text-sm font-bold text-ink-soft">
            {me.role === "owner" ? "Owner" : "Parent"} · {me.email}
          </p>
          <h1 className="font-display text-3xl font-semibold">Hi {me.displayName}</h1>
        </div>
        {signedIn ? (
          <div className="flex gap-2">
            <Link href="/wall" className="rounded-full bg-card px-4 py-2 font-bold shadow-soft">
              Wall view
            </Link>
            <button onClick={() => signOut()} className="rounded-full px-3 py-2 font-bold text-ink-soft">
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              lock();
              router.push(back);
            }}
            className="rounded-full bg-card px-4 py-2 font-bold shadow-soft"
          >
            Lock & exit
          </button>
        )}
      </header>

      {DATA_MODE === "supabase" && !me.hasPin && <SetPinBanner member={me} />}

      <nav className="mb-6 flex gap-1 rounded-full bg-card p-1 shadow-soft">
        {(["approvals", "family", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-2.5 font-bold capitalize ${tab === t ? "bg-ink text-white" : "text-ink-soft"}`}
          >
            {t}
            {t === "approvals" && pending.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-xs text-white">{pending.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "approvals" && <Approvals parentId={me.id} />}
      {tab === "family" && <Family />}
      {tab === "settings" && <Settings />}
    </div>
  );
}

function Approvals({ parentId }: { parentId: string }) {
  const family = useFamily();
  const pending = pendingTasks(family);
  if (pending.length === 0) {
    return (
      <div className="rounded-[28px] bg-card p-10 text-center shadow-soft">
        <p className="text-5xl">✨</p>
        <p className="mt-2 font-display text-2xl font-semibold">All caught up</p>
        <p className="text-ink-soft">Checked-off routine steps show up here for approval.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => approveTasks(pending.map((t) => t.id), parentId)}
        className="rounded-2xl bg-ok py-4 text-lg font-bold text-white shadow-soft"
      >
        ✓ Approve all {pending.length}
      </button>
      {kids(family).map((kid) => {
        const mine = pending.filter((t) => t.memberId === kid.id);
        if (mine.length === 0) return null;
        return (
          <section key={kid.id} className="rounded-[28px] bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-3">
              <Avatar member={kid} size={44} />
              <h2 className="flex-1 font-display text-2xl font-semibold">{kid.displayName}</h2>
              <button onClick={() => approveTasks(mine.map((t) => t.id), parentId)} className="rounded-full px-4 py-2 font-bold text-white" style={{ background: kid.color }}>
                Approve {mine.length}
              </button>
            </div>
            <ul className="divide-y divide-line">
              {mine.map((t) => {
                const routine = family.routines.find((r) => r.id === t.routineId);
                const step = routine?.steps.find((s) => s.id === t.stepId);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-2xl">{step?.icon}</span>
                    <span className="flex-1 font-semibold">
                      {step?.title} <span className="text-sm text-ink-soft">· {routine?.name}</span>
                    </span>
                    <button onClick={() => rejectTasks([t.id], parentId)} className="rounded-full px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-bg">
                      Not yet
                    </button>
                    <button onClick={() => approveTasks([t.id], parentId)} className="rounded-full bg-bg px-3 py-1.5 text-sm font-bold">
                      ✓
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Family() {
  const family = useFamily();
  const [editing, setEditing] = useState<Member | null>(null);
  const [pinFor, setPinFor] = useState<Member | null>(null);
  const COLORS = ["#1E3A8A", "#7E22CE", "#2563EB", "#16A34A", "#EA580C", "#DB2777", "#0D9488", "#CA8A04", "#DC2626", "#4F46E5"];

  return (
    <div className="flex flex-col gap-3">
      {[...parents(family), ...kids(family)].map((m) => (
        <section key={m.id} className="flex flex-wrap items-center gap-4 rounded-[28px] bg-card p-4 shadow-soft">
          <button onClick={() => setEditing(m)} className="group relative" aria-label={`Change ${m.displayName}'s photo`}>
            <Avatar member={m} size={72} />
            <span className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm text-white shadow-soft">📷</span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-2xl font-semibold">{m.displayName}</h3>
              <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink-soft">{m.role}</span>
            </div>
            {m.email && <p className="truncate text-sm text-ink-soft">{m.email}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setMemberColor(m.id, c)}
                  className="h-7 w-7 rounded-full"
                  style={{ background: c, boxShadow: m.color === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          {m.role !== "kid" && (
            <button onClick={() => setPinFor(m)} className="rounded-full bg-bg px-4 py-2 text-sm font-bold">
              {m.hasPin || m.pinHash ? "Change PIN" : "Set PIN"}
            </button>
          )}
        </section>
      ))}
      {editing && (
        <AvatarEditor
          member={editing}
          onClose={() => setEditing(null)}
          onSave={(url) => {
            void setMemberPhoto(editing.id, url);
            setEditing(null);
          }}
        />
      )}
      {pinFor && <ChangePin member={pinFor} onClose={() => setPinFor(null)} />}
      {family.viewer?.kind === "parent" && <PairWall />}
    </div>
  );
}

function PairWall() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="mt-3 rounded-[28px] bg-card p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold">📺 Pair a wall display</h2>
      <p className="mt-1 text-sm text-ink-soft">
        On the tablet, open Haagie Headquarters and tap &ldquo;Set up this screen as the wall display,&rdquo; then enter this code. It works once and
        expires in 10 minutes.
      </p>
      {code ? (
        <p className="mt-4 text-center font-display text-5xl font-semibold tracking-[0.3em]">{code}</p>
      ) : (
        <button
          onClick={() => createPairingCode().then(setCode, (e: Error) => setError(e.message))}
          className="mt-4 rounded-full bg-ink px-5 py-2.5 font-bold text-white"
        >
          Get a code
        </button>
      )}
      {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
    </section>
  );
}

function SetPinBanner({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[28px] bg-accent px-5 py-4 text-white shadow-soft">
      <span className="text-3xl">🔢</span>
      <div className="flex-1">
        <p className="font-bold">Set your wall PIN</p>
        <p className="text-sm opacity-90">You&apos;ll use it on the kitchen tablet to approve routines and change settings.</p>
      </div>
      <button onClick={() => setOpen(true)} className="rounded-full bg-white px-4 py-2 font-bold text-accent">
        Set PIN
      </button>
      {open && <ChangePin member={member} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChangePin({ member, onClose }: { member: Member; onClose: () => void }) {
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-xs rounded-3xl bg-card p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await setPin(member.id, pin);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <h2 className="font-display text-xl font-semibold">New PIN for {member.displayName}</h2>
        <input
          autoFocus
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
          className="mt-4 w-full rounded-2xl border-2 border-line bg-bg px-4 py-3 text-center font-display text-3xl tracking-[0.5em]"
        />
        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
        <button disabled={pin.length !== 4} className="mt-4 w-full rounded-2xl bg-ink py-3 font-bold text-white disabled:opacity-40">
          Save
        </button>
      </form>
    </div>
  );
}

function Settings() {
  const family = useFamily();
  const { togetherWindows, autoSwitchToTogether } = family.settings;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[28px] bg-card p-5 shadow-soft">
        <h2 className="font-display text-2xl font-semibold">Routine times</h2>
        <p className="mb-4 text-sm text-ink-soft">The wall shows the Together view during these windows.</p>
        {WINDOW_ORDER.map((w) => (
          <div key={w} className="flex items-center gap-3 border-t border-line py-3">
            <span className="flex-1 font-bold">{WINDOW_LABELS[w]}</span>
            {(["start", "end"] as const).map((k) => (
              <input
                key={k}
                type="time"
                value={togetherWindows[w][k]}
                onChange={(e) =>
                  updateSettings({ togetherWindows: { ...togetherWindows, [w]: { ...togetherWindows[w], [k]: e.target.value } } })
                }
                className="rounded-xl border-2 border-line bg-bg px-3 py-1.5 font-semibold"
              />
            ))}
          </div>
        ))}
        <label className="mt-2 flex items-center gap-3 border-t border-line pt-4 font-bold">
          <input
            type="checkbox"
            checked={autoSwitchToTogether}
            onChange={(e) => updateSettings({ autoSwitchToTogether: e.target.checked })}
            className="h-5 w-5 accent-[var(--accent)]"
          />
          Switch the wall to routines automatically when a window starts
        </label>
      </section>
      {DATA_MODE === "local" && <section className="rounded-[28px] bg-card p-5 shadow-soft">
        <h2 className="font-display text-2xl font-semibold">Preview data</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Everything is saved in this browser until Supabase is connected. Default PIN for both parents is 1234.
        </p>
        <button
          onClick={() => confirm("Reset all preview data?") && resetPreviewData()}
          className="rounded-full bg-bg px-4 py-2 font-bold text-red-600"
        >
          Reset preview data
        </button>
      </section>}
    </div>
  );
}
