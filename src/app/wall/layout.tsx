import { WallShell } from "@/components/WallShell";

export default function WallLayout({ children }: { children: React.ReactNode }) {
  return <WallShell>{children}</WallShell>;
}
