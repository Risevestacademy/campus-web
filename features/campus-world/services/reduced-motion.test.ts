import { afterEach, describe, expect, it, vi } from "vitest";

import { prefersReducedMotion } from "./reduced-motion";

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it.each([true, false])(
    "reads %s from the reduced motion query",
    (matches) => {
      const matchMedia = stubMatchMedia(matches);

      expect(prefersReducedMotion()).toBe(matches);
      expect(matchMedia).toHaveBeenCalledWith(
        "(prefers-reduced-motion: reduce)",
      );
    },
  );

  it("allows motion where the browser cannot answer", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
