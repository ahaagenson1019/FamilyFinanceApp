"use client";

import { useEffect, useState } from "react";

const TZ = "America/Chicago";

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(now);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(now);
  return (
    <div>
      <div className="font-display text-7xl font-semibold tracking-tight tabular-nums md:text-8xl">{time.replace(/\s?[AP]M/, "")}<span className="ml-2 text-3xl text-ink-soft">{time.match(/[AP]M/)?.[0].toLowerCase()}</span></div>
      <div className="mt-1 text-xl font-semibold text-ink-soft">{date}</div>
    </div>
  );
}
