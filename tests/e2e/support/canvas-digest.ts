import { createHash } from "node:crypto";

import { expect, type Locator } from "@playwright/test";

// A hash of the drawn pixels: two frames match only when they look the same,
// whatever the art. Compare against references drawn in the same test.
export async function canvasDigest(canvas: Locator): Promise<string> {
  const screenshot = await canvas.screenshot();
  return createHash("sha256").update(screenshot).digest("hex");
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
