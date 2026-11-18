const WINDOW_WAKE_EVENTS = ["focus", "online", "pageshow"] as const;

export function browserIsOnline(): boolean {
  return navigator.onLine;
}

export function subscribeToBrowserWake(listener: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };

  document.addEventListener("visibilitychange", onVisible);
  for (const event of WINDOW_WAKE_EVENTS)
    window.addEventListener(event, listener);

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    for (const event of WINDOW_WAKE_EVENTS) {
      window.removeEventListener(event, listener);
    }
  };
}
