export type Theme = "light" | "dark";
// What the member chose: a theme, or "system" to follow the operating system.
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "campus-theme";
export const THEME_CHANGE_EVENT = "campus-theme-change";
export const SERVER_THEME: Theme = "light";
export const SERVER_THEME_PREFERENCE: ThemePreference = "system";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(
  storedTheme: string | null,
  prefersDark: boolean,
): Theme {
  if (isTheme(storedTheme)) return storedTheme;

  return prefersDark ? "dark" : "light";
}

export const themeInitializerScript = String.raw`
(() => {
  let storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
  } catch {
    // Continue with the system preference when storage is unavailable.
  }

  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";

  document.documentElement.dataset.theme = theme;
})();
`.trim();
