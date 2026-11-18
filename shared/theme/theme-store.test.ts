import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "./theme";
import {
  getThemePreferenceSnapshot,
  setThemePreference,
  subscribeToTheme,
  toggleTheme,
} from "./theme-store";

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

  it("forgets the stored theme when the member chooses to match the device", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    setThemePreference("light");
    expect(getThemePreferenceSnapshot()).toBe("light");

    setThemePreference("system");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(getThemePreferenceSnapshot()).toBe("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    vi.unstubAllGlobals();
  });

  it("follows the operating system live only while no theme is stored", () => {
    let prefersDark = false;
    let notifySystemChange = () => {};
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return prefersDark;
        },
        addEventListener: (_: string, listener: () => void) => {
          notifySystemChange = listener;
        },
        removeEventListener: () => undefined,
      })),
    );
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToTheme(onStoreChange);

    prefersDark = true;
    notifySystemChange();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    document.documentElement.dataset.theme = "light";
    notifySystemChange();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(onStoreChange).toHaveBeenCalledOnce();

    unsubscribe();
    vi.unstubAllGlobals();
  });
});
