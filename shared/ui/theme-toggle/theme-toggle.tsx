"use client";

import { MoonIcon } from "@phosphor-icons/react/Moon";
import { SunIcon } from "@phosphor-icons/react/Sun";
import { useSyncExternalStore } from "react";

import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribeToTheme,
  toggleTheme,
} from "@/shared/theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const isDark = theme === "dark";
  const label = `Switch to ${isDark ? "light" : "dark"} mode`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={toggleTheme}
      className="border-border bg-surface-elevated text-icon hover:bg-surface-hover active:bg-surface-pressed focus-visible:ring-border-focus focus-visible:ring-offset-background fixed top-4 right-4 z-50 grid size-10 cursor-pointer place-items-center rounded-full border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {isDark ? (
        <SunIcon aria-hidden size={16} weight="regular" />
      ) : (
        <MoonIcon aria-hidden size={16} weight="regular" />
      )}
    </button>
  );
}
