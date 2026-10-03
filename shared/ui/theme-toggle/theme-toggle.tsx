"use client";

import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun";

import { useThemeToggle } from "./use-theme-toggle";

// Hidden wherever a page hosts its own theme switch (an element marked
// data-theme-toggle-host, such as the campus rail), so it never floats over
// that page's controls.
export function ThemeToggle() {
  const { isDark, label, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={toggle}
      className="bg-surface border-border text-icon hover:bg-surface-hover active:bg-surface-pressed focus-visible:ring-border-focus focus-visible:ring-offset-background fixed bottom-3 left-3 z-50 grid size-10 cursor-pointer place-items-center rounded-full border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 [:root:has([data-theme-toggle-host])_&]:hidden"
    >
      {isDark ? (
        <SunIcon aria-hidden size={16} weight="regular" />
      ) : (
        <MoonIcon aria-hidden size={16} weight="regular" />
      )}
    </button>
  );
}
