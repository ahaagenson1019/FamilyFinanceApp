import { Gate } from "@/components/Gate";
import { WallShell } from "@/components/WallShell";

export default function WallLayout({ children }: { children: React.ReactNode }) {
  return (
    <Gate next="/wall">
      <WallShell>{children}</WallShell>
    </Gate>
  );
}
