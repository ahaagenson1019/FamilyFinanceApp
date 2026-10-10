"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parents, useFamily } from "@/lib/store";
import { activeWindow } from "@/lib/time";
import { Avatar } from "./Avatar";
import { useParentSession } from "./ParentSession";

const NAV = [
  { href: "/wall", label: "Home", icon: "🏠" },
  { href: "/wall/together", label: "Routines", icon: "✅" },
  { href: "/wall/calendar", label: "Calendar", icon: "📅", soon: true },
  { href: "/wall/stars", label: "Star shop", icon: "⭐", soon: true },
  { href: "/wall/lists", label: "Lists", icon: "🛒", soon: true },
];

export function WallShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const family = useFamily();
  const { parentId, expiresAt, requireParent, lock } = useParentSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Auto-switch to the Together view when a routine window starts. The first
  // check only records the current window, so reloading mid-routine doesn't
  // yank someone off the screen they chose.
  const lastWindow = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const check = () => {
      const w = activeWindow(family.settings);
      const started = lastWindow.current !== undefined && w !== null && w !== lastWindow.current;
      if (started && family.settings.autoSwitchToTogether) router.push("/wall/together");
      lastWindow.current = w;
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [family.settings, router]);

  const unlockedParent = family.members.find((m) => m.id === parentId);

  return (
    <div className="kiosk flex h-dvh flex-col bg-bg md:flex-row">
      <nav className="order-last flex shrink-0 items-center justify-around border-t border-line bg-card/70 px-2 py-1.5 backdrop-blur md:order-first md:w-24 md:flex-col md:justify-start md:gap-2 md:border-t-0 md:border-r md:py-6">
        <div className="mb-4 hidden font-display text-lg font-bold leading-tight text-accent md:block" title="Haagie Headquarters">
          HHQ
        </div>
        {NAV.map((n) => {
          const active = n.href === "/wall" ? pathname === "/wall" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex w-16 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-colors md:w-20 md:py-3 md:text-xs ${
                active ? "bg-ink text-white" : "text-ink-soft hover:bg-bg-deep"
              }`}
            >
              <span className="text-2xl leading-none md:text-3xl">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
        <div className="hidden flex-1 md:block" />
        {mounted && (
          <button
            onClick={() => (unlockedParent ? lock() : requireParent((id) => router.push(`/parent?from=${encodeURIComponent(pathname)}&as=${id}`)))}
            className="flex w-16 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-bold text-ink-soft md:w-20 md:text-xs"
          >
            {unlockedParent ? (
              <>
                <Avatar member={unlockedParent} size={40} />
                <span className="text-ok">Unlocked</span>
                <SessionTimer expiresAt={expiresAt} />
              </>
            ) : (
              <>
                <div className="flex -space-x-3">
                  {parents(family).map((p) => (
                    <Avatar key={p.id} member={p} size={36} ring={false} className="border-2 border-card" />
                  ))}
                </div>
                Parents
              </>
            )}
          </button>
        )}
      </nav>
      <main className="min-h-0 flex-1 overflow-hidden">{mounted ? children : null}</main>
    </div>
  );
}

function SessionTimer({ expiresAt }: { expiresAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  const s = Math.max(0, Math.round((expiresAt - now) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} · Lock
    </span>
  );
}
