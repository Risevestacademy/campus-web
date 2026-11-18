import type { Area } from "react-easy-crop";

export const AVATAR_SIZE = 512;

function loadImage(source: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => resolve(undefined));
    image.src = source;
  });
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
): Promise<Blob | undefined> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? undefined), type, 0.9);
  });
}

// Draws the cropped square onto a 512×512 canvas and exports it as WebP, or
// JPEG where the browser cannot encode WebP (it hands back PNG instead).
// Re-encoding through the canvas also drops the photo's EXIF, GPS included.
export async function cropAvatar(
  source: string,
  area: Area,
): Promise<Blob | undefined> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!image || !context) return undefined;

  // A transparent picture would turn black as JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );

  const webp = await encode(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode(canvas, "image/jpeg");
  return jpeg?.type === "image/jpeg" ? jpeg : undefined;
}
