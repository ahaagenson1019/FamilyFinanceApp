import type { Member } from "@/lib/types";

interface Props {
  member: Member;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function Avatar({ member, size = 64, ring = true, className = "" }: Props) {
  const ringWidth = Math.max(2, Math.round(size / 18));
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 ${ringWidth}px var(--card), 0 0 0 ${ringWidth * 2}px ${member.color}` : undefined,
      }}
    >
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt={member.displayName}
          className="h-full w-full rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-display font-semibold text-white"
          style={{ background: member.color, fontSize: size * (member.avatarEmoji ? 0.5 : 0.42) }}
          aria-label={member.displayName}
        >
          {member.avatarEmoji ?? member.displayName[0]}
        </div>
      )}
    </div>
  );
}
