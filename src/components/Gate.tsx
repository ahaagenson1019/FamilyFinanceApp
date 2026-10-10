"use client";

import { useState } from "react";
import { clearError, pairThisDevice, signInWithGoogle, signOut, useFamily } from "@/lib/store";

/** Shows sign-in, wall pairing, or errors until the family has loaded, then renders children. */
export function Gate({ children, next = "/" }: { children: React.ReactNode; next?: string }) {
  const family = useFamily();

  if (family.status === "loading") return <Splash />;
  if (family.status === "signed_out") return <SignIn next={next} />;
  if (family.status === "unpaired") return <SignIn next={next} startPairing />;
  if (family.status === "not_member") {
    return (
      <Centered>
        <p className="text-5xl">🔒</p>
        <h1 className="font-display text-3xl font-semibold">Not part of this family</h1>
        <p className="max-w-sm text-ink-soft">
          {family.error ?? "This account"} isn&apos;t set up in Haagie Headquarters. Ask Andy to add your Google address.
        </p>
        <button onClick={() => signOut()} className="rounded-full bg-ink px-6 py-3 font-bold text-white">
          Use a different account
        </button>
      </Centered>
    );
  }
  if (family.status === "error") {
    return (
      <Centered>
        <p className="text-5xl">😵</p>
        <h1 className="font-display text-3xl font-semibold">Couldn&apos;t load the family</h1>
        <p className="max-w-sm text-ink-soft">{family.error}</p>
        <button onClick={() => window.location.reload()} className="rounded-full bg-ink px-6 py-3 font-bold text-white">
          Try again
        </button>
      </Centered>
    );
  }
  return (
    <>
      {children}
      {family.error && (
        <div className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-soft md:bottom-6">
          <span className="flex-1">{family.error}</span>
          <button onClick={clearError} className="font-bold">
            OK
          </button>
        </div>
      )}
    </>
  );
}

function Splash() {
  return (
    <Centered>
      <p className="animate-pulse font-display text-3xl font-semibold text-accent">Haagie Headquarters</p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">{children}</div>;
}

function SignIn({ next, startPairing = false }: { next: string; startPairing?: boolean }) {
  const [pairing, setPairing] = useState(startPairing);
  const [code, setCode] = useState("");
  const [name, setName] = useState("Kitchen wall");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Centered>
      <div className="animate-rise w-full max-w-md rounded-[32px] bg-card p-8 shadow-soft">
        <p className="text-5xl">🏡</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Haagie Headquarters</h1>
        {!pairing ? (
          <>
            <p className="mt-2 text-ink-soft">The Haagenson family command center</p>
            <button
              onClick={() => signInWithGoogle(next)}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-line bg-white py-4 text-lg font-bold"
            >
              <GoogleMark /> Sign in with Google
            </button>
            <button onClick={() => setPairing(true)} className="mt-3 w-full rounded-2xl bg-bg py-4 font-bold text-ink-soft">
              📺 Set up this screen as the wall display
            </button>
          </>
        ) : (
          <form
            className="mt-6 text-left"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await pairThisDevice(code, name);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-ink-soft">
              On your phone, open Haagie Headquarters → <b>Family</b> → <b>Pair a wall display</b>, then type the code here.
            </p>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="mt-5 w-full rounded-2xl border-2 border-line bg-bg px-4 py-4 text-center font-display text-4xl tracking-[0.4em]"
            />
            <label className="mt-4 block text-sm font-bold text-ink-soft">
              Screen name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-bg px-3 py-2 font-semibold text-ink" />
            </label>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
            <button disabled={code.length !== 6 || busy} className="mt-5 w-full rounded-2xl bg-ink py-4 text-lg font-bold text-white disabled:opacity-40">
              {busy ? "Pairing…" : "Pair this screen"}
            </button>
            <button type="button" onClick={() => setPairing(false)} className="mt-2 w-full py-2 font-bold text-ink-soft">
              Back
            </button>
          </form>
        )}
      </div>
    </Centered>
  );
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
