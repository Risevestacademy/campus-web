import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOTION_STORAGE_KEY, motionInitializerScript } from "./motion";
import {
  getMotionPreferenceSnapshot,
  setMotionPreference,
  subscribeToMotionPreference,
} from "./motion-store";

beforeEach(() => {
  delete document.documentElement.dataset.motion;
  window.localStorage.clear();
});

describe("motion store", () => {
  it("marks the document and remembers a choice to reduce motion", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToMotionPreference(onStoreChange);

    setMotionPreference("reduce");

    expect(document.documentElement).toHaveAttribute("data-motion", "reduce");
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("reduce");
    expect(getMotionPreferenceSnapshot()).toBe("reduce");
    expect(onStoreChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("forgets the choice when the member follows the device again", () => {
    setMotionPreference("reduce");
    setMotionPreference("device");

    expect(document.documentElement).not.toHaveAttribute("data-motion");
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(getMotionPreferenceSnapshot()).toBe("device");
  });

  it("follows a choice made in another tab, ignoring values it does not know", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToMotionPreference(onStoreChange);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: MOTION_STORAGE_KEY,
        newValue: "reduce",
      }),
    );
    expect(document.documentElement).toHaveAttribute("data-motion", "reduce");

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: MOTION_STORAGE_KEY,
        newValue: "sideways",
      }),
    );
    expect(document.documentElement).not.toHaveAttribute("data-motion");
    expect(onStoreChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("restores a stored choice before hydration", () => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, "reduce");

    new Function(motionInitializerScript)();

    expect(document.documentElement).toHaveAttribute("data-motion", "reduce");
  });
});
