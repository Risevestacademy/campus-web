import {
  isTheme,
  resolveTheme,
  SERVER_THEME,
  SERVER_THEME_PREFERENCE,
  type Theme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function prefersDarkMode(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function supportsViewTransitions(): boolean {
  return typeof document.startViewTransition === "function";
}

export function getThemeSnapshot(): Theme {
  const activeTheme = document.documentElement.dataset.theme ?? null;

  if (isTheme(activeTheme)) {
    return activeTheme;
  }

  return resolveTheme(readStoredTheme(), prefersDarkMode());
}

export function getServerThemeSnapshot(): Theme {
  return SERVER_THEME;
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The active document can still use the selected theme without storage.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function getThemePreferenceSnapshot(): ThemePreference {
  const storedTheme = readStoredTheme();
  return isTheme(storedTheme) ? storedTheme : "system";
}

export function getServerThemePreferenceSnapshot(): ThemePreference {
  return SERVER_THEME_PREFERENCE;
}

function forgetStoredTheme(): void {
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Without storage the operating-system theme already applies next visit.
  }
}

function applyThemePreference(preference: ThemePreference): void {
  if (preference !== "system") {
    setTheme(preference);
    return;
  }

  forgetStoredTheme();
  applyTheme(resolveTheme(null, prefersDarkMode()));
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function setThemePreference(preference: ThemePreference): void {
  if (!supportsViewTransitions()) {
    applyThemePreference(preference);
    return;
  }

  document.startViewTransition(() => applyThemePreference(preference));
}

export function toggleTheme(): void {
  const nextTheme = getThemeSnapshot() === "dark" ? "light" : "dark";

  if (!supportsViewTransitions()) {
    setTheme(nextTheme);
    return;
  }

  document.startViewTransition(() => setTheme(nextTheme));
}

export function subscribeToTheme(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent): void {
    if (event.key !== THEME_STORAGE_KEY) {
      return;
    }

    applyTheme(resolveTheme(event.newValue, prefersDarkMode()));
    onStoreChange();
  }

  // A member who follows the operating system sees its theme change live.
  function handleSystemThemeChange(): void {
    if (isTheme(readStoredTheme())) return;

    applyTheme(resolveTheme(null, prefersDarkMode()));
    onStoreChange();
  }

  const systemTheme =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  systemTheme?.addEventListener("change", handleSystemThemeChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
    systemTheme?.removeEventListener("change", handleSystemThemeChange);
  };
}
