"use client";

import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun";
import { cn } from "cn";

import { floatingControlClassName } from "../floating-control";
import { useThemeToggle } from "./use-theme-toggle";

export function ThemeToggle() {
  const { isDark, label, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={toggle}
      className={cn(floatingControlClassName, "bottom-3 z-50")}
    >
      {isDark ? (
        <SunIcon aria-hidden size={16} weight="regular" />
      ) : (
        <MoonIcon aria-hidden size={16} weight="regular" />
      )}
    </button>
  );
}
