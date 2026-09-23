import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "./theme";
import { subscribeToTheme, toggleTheme } from "./theme-store";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  window.localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("theme store", () => {
  it("synchronizes theme changes received from another browser tab", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToTheme(onStoreChange);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "dark",
      }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(onStoreChange).toHaveBeenCalledOnce();

    unsubscribe();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "light",
      }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(onStoreChange).toHaveBeenCalledOnce();
  });

  it("changes theme through a native view transition when supported", () => {
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return {} as ViewTransition;
    });

    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    toggleTheme();

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
