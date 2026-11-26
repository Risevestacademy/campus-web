// "14:20", the time the events last loaded on this device, in the viewer's
// own locale and zone.
export function formatLoadedTime(at: number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}
