import { cn } from "cn";

import type { ScheduleItem, ScheduleTone } from "./overview-data";

const TONE_CLASS_NAMES: Readonly<Record<ScheduleTone, string>> = {
  cobalt: "bg-cobalt-500",
  violet: "bg-[#7A3FE0]",
  error: "bg-error-400",
};

export function TodayScheduleCard({
  label,
  schedule,
}: {
  label: string;
  schedule: readonly ScheduleItem[];
}) {
  return (
    <section
      aria-labelledby="today-heading"
      className="border-border grid content-start gap-5 rounded-2xl border p-6 dark:border-[#2B3B5F]"
    >
      <header className="grid gap-1">
        <h2 id="today-heading" className="font-display text-xl font-semibold">
          Today
        </h2>
        <p className="text-foreground-secondary text-sm">{label}</p>
      </header>

      <ol className="grid gap-1">
        {schedule.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-4 rounded-xl p-3",
              item.isLive && "bg-cobalt-500/10",
            )}
          >
            <time className="text-foreground-secondary w-11 shrink-0 text-sm tabular-nums">
              {item.time}
            </time>
            <span
              aria-hidden
              className={cn("h-9 w-0.5 shrink-0", TONE_CLASS_NAMES[item.tone])}
            />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate text-sm font-medium">{item.title}</span>
              <span className="text-foreground-secondary truncate text-sm">
                {item.detail}
              </span>
            </span>
            {item.isLive ? (
              <span className="bg-error-500 text-error-50 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                LIVE
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
