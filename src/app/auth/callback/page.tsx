"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useFamily } from "@/lib/store";

// supabase-js finishes the Google sign-in from the ?code= in this URL on its
// own (detectSessionInUrl). We just wait for the family to load, then move on.
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const family = useFamily();
  const next = params.get("next") ?? "/";
  const oauthError = params.get("error_description");

  useEffect(() => {
    if (!oauthError && family.status !== "loading") router.replace(next.startsWith("/") ? next : "/");
  }, [family.status, next, oauthError, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      {oauthError ? (
        <>
          <h1 className="font-display text-3xl font-semibold">Sign-in didn&apos;t work</h1>
          <p className="max-w-sm text-ink-soft">{oauthError}</p>
          <Link href="/" className="rounded-full bg-ink px-6 py-3 font-bold text-white">
            Try again
          </Link>
        </>
      ) : (
        <p className="animate-pulse font-display text-3xl font-semibold text-accent">Signing you in…</p>
      )}
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
