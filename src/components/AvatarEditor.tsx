"use client";

import { useEffect, useRef, useState } from "react";
import { clampCrop, drawCrop, exportAvatar, loadImage, type CropState } from "@/lib/image";
import type { Member } from "@/lib/types";

const PREVIEW = 280;

interface Props {
  member: Member;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

/** Pick or take a photo, then pan/zoom it inside a circle. Output: 512px WebP, EXIF-free. */
export function AvatarEditor({ member, onSave, onClose }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && img) drawCrop(ctx, img, crop, PREVIEW);
  }, [img, crop]);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const loaded = await loadImage(file);
      setImg(loaded);
      setCrop({ zoom: 1, x: 0, y: 0 });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const update = (next: CropState) => img && setCrop(clampCrop(img, next, PREVIEW));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-rise w-full max-w-md rounded-3xl bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-semibold">{member.displayName}&apos;s photo</h2>

        <div className="mt-5 flex justify-center">
          <div
            className="relative overflow-hidden rounded-full bg-bg-deep"
            style={{ width: PREVIEW, height: PREVIEW, boxShadow: `0 0 0 6px var(--card), 0 0 0 12px ${member.color}`, touchAction: "none" }}
            onPointerDown={(e) => {
              if (!img) return;
              (e.target as Element).setPointerCapture(e.pointerId);
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== e.pointerId) return;
              update({ ...crop, x: crop.x + e.clientX - d.x, y: crop.y + e.clientY - d.y });
              drag.current = { ...d, x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => (drag.current = null)}
            onWheel={(e) => update({ ...crop, zoom: Math.min(4, Math.max(1, crop.zoom - e.deltaY / 500)) })}
          >
            {img ? (
              <canvas ref={canvasRef} width={PREVIEW} height={PREVIEW} className="h-full w-full cursor-grab" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-ink-soft">
                <span>
                  <span className="block text-5xl">📷</span>
                  Choose or take a photo
                </span>
              </div>
            )}
          </div>
        </div>

        {img && (
          <label className="mt-6 flex items-center gap-3 text-sm font-bold text-ink-soft">
            Zoom
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => update({ ...crop, zoom: Number(e.target.value) })}
              className="flex-1"
              style={{ accentColor: member.color }}
            />
          </label>
        )}
        {img && <p className="mt-2 text-center text-xs text-ink-soft">Drag to move. Location data is removed before saving.</p>}
        {error && <p className="mt-3 text-center text-sm font-bold text-red-600">{error}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-2xl bg-bg py-3 text-center font-bold">
            📸 Take photo
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <label className="cursor-pointer rounded-2xl bg-bg py-3 text-center font-bold">
            🖼️ Choose photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        </div>
        <div className="mt-3 flex gap-3">
          {member.avatarUrl && (
            <button onClick={() => onSave("")} className="rounded-2xl px-4 py-3 font-bold text-red-600">
              Remove
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-2xl py-3 font-bold text-ink-soft">
            Cancel
          </button>
          <button
            disabled={!img}
            onClick={() => img && onSave(exportAvatar(img, crop, PREVIEW))}
            className="flex-1 rounded-2xl py-3 font-bold text-white disabled:opacity-40"
            style={{ background: member.color }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
