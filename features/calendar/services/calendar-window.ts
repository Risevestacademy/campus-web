export type CalendarWindow = Readonly<{ from: string; to: string }>;

// The Monday-to-Monday week that holds `now`, in the viewer's own time zone,
// as the zoned timestamps campus-api reads for `from` and `to`.
export function weekWindowOf(now: Date): CalendarWindow {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { from: start.toISOString(), to: end.toISOString() };
}
