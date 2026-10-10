// Renders the cropped region to a fresh canvas and re-encodes it. Drawing
// to a canvas drops all EXIF metadata (including GPS), so nothing from the
// original file survives except the pixels.

export interface CropState {
  /** Zoom multiplier on top of "cover" scale. 1 = image just covers the square. */
  zoom: number;
  /** Pan offset in output pixels, relative to centered. */
  x: number;
  y: number;
}

export const AVATAR_SIZE = 512;

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

export function coverScale(img: HTMLImageElement, size: number) {
  return Math.max(size / img.naturalWidth, size / img.naturalHeight);
}

/** Clamp pan so the image always fully covers the square. */
export function clampCrop(img: HTMLImageElement, crop: CropState, size: number): CropState {
  const scale = coverScale(img, size) * crop.zoom;
  const maxX = Math.max(0, (img.naturalWidth * scale - size) / 2);
  const maxY = Math.max(0, (img.naturalHeight * scale - size) / 2);
  return {
    zoom: crop.zoom,
    x: Math.min(maxX, Math.max(-maxX, crop.x)),
    y: Math.min(maxY, Math.max(-maxY, crop.y)),
  };
}

export function drawCrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, crop: CropState, size: number) {
  const scale = coverScale(img, size) * crop.zoom;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2 + crop.x, (size - h) / 2 + crop.y, w, h);
}

export function exportAvatar(img: HTMLImageElement, crop: CropState, previewSize: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  const ratio = AVATAR_SIZE / previewSize;
  drawCrop(ctx, img, { zoom: crop.zoom, x: crop.x * ratio, y: crop.y * ratio }, AVATAR_SIZE);
  return canvas.toDataURL("image/webp", 0.85);
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
