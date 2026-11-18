import { describe, expect, it, vi } from "vitest";

import { subscribeToBrowserWake } from "./browser-lifecycle";

describe("subscribeToBrowserWake", () => {
  it.each(["focus", "online", "pageshow"])(
    "reports the window %s event until unsubscribed",
    (event) => {
      const listener = vi.fn();
      const unsubscribe = subscribeToBrowserWake(listener);

      window.dispatchEvent(new Event(event));
      unsubscribe();
      window.dispatchEvent(new Event(event));

      expect(listener).toHaveBeenCalledOnce();
    },
  );

  it("reports only visibility changes that make the document visible", () => {
    const listener = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const unsubscribe = subscribeToBrowserWake(listener);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    unsubscribe();
    visibility.mockRestore();

    expect(listener).toHaveBeenCalledOnce();
  });
});
