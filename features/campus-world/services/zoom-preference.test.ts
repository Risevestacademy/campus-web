import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadZoomLevel, saveZoomLevel } from "./zoom-preference";

describe("zoom preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the level a viewer saved", () => {
    saveZoomLevel(3);

    expect(loadZoomLevel()).toBe(3);
  });

  it("starts at 2x when nothing is saved", () => {
    expect(loadZoomLevel()).toBe(2);
  });

  it("starts at 2x when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(loadZoomLevel()).toBe(2);
  });

  it("keeps going when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });

    expect(() => saveZoomLevel(1)).not.toThrow();
  });
});
