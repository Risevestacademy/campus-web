import {
  isTheme,
  resolveTheme,
  SERVER_THEME,
  type Theme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
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

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}
