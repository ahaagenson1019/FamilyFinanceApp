import { notFound } from "next/navigation";

const SOON: Record<string, { title: string; icon: string; phase: string }> = {
  calendar: { title: "Family calendar", icon: "📅", phase: "Phase 3: syncs your five Google calendars" },
  stars: { title: "Star shop", icon: "⭐", phase: "Phase 2: spend stars on rewards" },
  lists: { title: "Lists", icon: "🛒", phase: "Phase 5: groceries and to-dos" },
};

export default async function ComingSoon({ params }: { params: Promise<{ soon: string }> }) {
  const { soon } = await params;
  const page = SOON[soon];
  if (!page) notFound();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-7xl">{page.icon}</div>
      <h1 className="font-display text-4xl font-semibold">{page.title}</h1>
      <p className="text-lg text-ink-soft">Coming in {page.phase}</p>
    </div>
  );
}
