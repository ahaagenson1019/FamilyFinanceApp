"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { lockDevice, parents, useFamily, verifyPin } from "@/lib/store";
import { Avatar } from "./Avatar";
import type { Member } from "@/lib/types";

const SESSION_MS = 5 * 60 * 1000;

interface ParentSession {
  parentId: string | null;
  expiresAt: number | null;
  /** Runs `then` immediately if a parent session is active, otherwise asks for a PIN first. */
  requireParent: (then?: (parentId: string) => void) => void;
  lock: () => void;
}

const Ctx = createContext<ParentSession | null>(null);

export function useParentSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useParentSession must be used inside ParentSessionProvider");
  return ctx;
}

export function ParentSessionProvider({ children }: { children: React.ReactNode }) {
  const family = useFamily();
  const [pinSession, setSession] = useState<{ parentId: string; expiresAt: number } | null>(null);
  // A parent signed in with Google on their own device never needs a PIN.
  const signedInParent = family.viewer?.kind === "parent" ? family.viewer.memberId : null;
  const session = useMemo(
    () => (signedInParent ? { parentId: signedInParent, expiresAt: Number.POSITIVE_INFINITY } : pinSession),
    [signedInParent, pinSession],
  );
  const [prompt, setPrompt] = useState<{ then?: (id: string) => void } | null>(null);

  useEffect(() => {
    if (!pinSession) return;
    const t = setTimeout(() => setSession(null), pinSession.expiresAt - Date.now());
    return () => clearTimeout(t);
  }, [pinSession]);

  const requireParent = useCallback(
    (then?: (id: string) => void) => {
      if (session && session.expiresAt > Date.now()) then?.(session.parentId);
      else setPrompt({ then });
    },
    [session],
  );

  const lock = useCallback(() => {
    setSession(null);
    void lockDevice();
  }, []);

  return (
    <Ctx.Provider
      value={{
        parentId: session?.parentId ?? null,
        expiresAt: session && Number.isFinite(session.expiresAt) ? session.expiresAt : null,
        requireParent,
        lock,
      }}
    >
      {children}
      {prompt && (
        <PinDialog
          onCancel={() => setPrompt(null)}
          onSuccess={(id, expiresAt) => {
            setSession({ parentId: id, expiresAt: Math.min(expiresAt, Date.now() + SESSION_MS) });
            const then = prompt.then;
            setPrompt(null);
            then?.(id);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function PinDialog({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: (id: string, expiresAt: number) => void }) {
  const family = useFamily();
  const ps = parents(family).filter((p) => p.hasPin || p.pinHash);
  const [who, setWho] = useState<Member | null>(ps.length === 1 ? ps[0] : null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!who || pin.length < 4) return;
    let cancelled = false;
    verifyPin(who.id, pin)
      .then((expiresAt) => {
        if (cancelled) return;
        if (expiresAt) return onSuccess(who.id, expiresAt);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
        }, 450);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setMessage(e.message);
        setPin("");
      });
    return () => {
      cancelled = true;
    };
  }, [pin, who, onSuccess]);

  const press = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));

  return (
    <div className="kiosk fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="animate-rise w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        {ps.length === 0 ? (
          <>
            <h2 className="font-display text-2xl font-semibold">No parent PIN yet</h2>
            <p className="mt-2 text-ink-soft">
              Sign in on your phone, open Haagie Headquarters, and set a wall PIN under Family. Then come back here.
            </p>
            <button onClick={onCancel} className="mt-6 w-full rounded-2xl bg-bg py-3 font-bold">
              OK
            </button>
          </>
        ) : !who ? (
          <>
            <h2 className="font-display text-2xl font-semibold">Grown-ups only</h2>
            <p className="mt-1 text-ink-soft">Who&apos;s unlocking?</p>
            <div className="mt-6 flex justify-center gap-8">
              {ps.map((p) => (
                <button key={p.id} onClick={() => setWho(p)} className="flex flex-col items-center gap-2">
                  <Avatar member={p} size={88} />
                  <span className="font-semibold">{p.displayName}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar member={who} size={48} />
              <div>
                <h2 className="font-display text-xl font-semibold">Hi {who.displayName}</h2>
                <p className="text-sm text-ink-soft">Enter your PIN</p>
              </div>
            </div>
            {message && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-700">{message}</p>}
            <div className={`my-6 flex justify-center gap-4 ${shake ? "animate-[pop_300ms]" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border-2"
                  style={{
                    borderColor: shake ? "#dc2626" : who.color,
                    background: i < pin.length ? (shake ? "#dc2626" : who.color) : "transparent",
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <PinKey key={d} onPress={() => press(d)}>{d}</PinKey>
              ))}
              <PinKey onPress={() => (ps.length > 1 ? (setWho(null), setPin("")) : onCancel())}>
                <span className="text-base text-ink-soft">{ps.length > 1 ? "Back" : "Cancel"}</span>
              </PinKey>
              <PinKey onPress={() => press("0")}>0</PinKey>
              <PinKey onPress={() => setPin((p) => p.slice(0, -1))}>
                <span className="text-base text-ink-soft">⌫</span>
              </PinKey>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PinKey({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="h-16 rounded-2xl bg-bg font-display text-2xl font-semibold active:bg-bg-deep"
    >
      {children}
    </button>
  );
}
