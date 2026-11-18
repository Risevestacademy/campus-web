"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function format(iso: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function LocalDateTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => format(iso, undefined),
    () => `${format(iso, "UTC")} UTC`,
  );

  return <time dateTime={iso}>{text}</time>;
}
