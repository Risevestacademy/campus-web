import { createHash } from "node:crypto";

import { expect, type Locator } from "@playwright/test";

// A hash of the drawn pixels: two frames match only when they look the same,
// whatever the art. Compare against references drawn in the same test.
// Reads the canvas itself, not a page screenshot, so controls and tiles laid
// over the map (and their hover states) never count. KAPLAY keeps its drawing
// buffer, so the last frame can be read between frames.
export async function canvasDigest(canvas: Locator): Promise<string> {
  const pixels = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL(),
  );
  return createHash("sha256").update(pixels).digest("hex");
}

export async function expectCanvasDigest(canvas: Locator, digest: string) {
  await expect.poll(() => canvasDigest(canvas)).toBe(digest);
}

// The digest once two captures in a row agree, so a walk has finished.
export async function settledDigest(canvas: Locator): Promise<string> {
  let previous = "";
  let settled = "";
  await expect
    .poll(async () => {
      const current = await canvasDigest(canvas);
      settled = current === previous ? current : "";
      previous = current;
      return settled;
    })
    .not.toBe("");
  return settled;
}
