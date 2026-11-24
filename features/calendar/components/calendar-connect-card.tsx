import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";

import { ConnectCalendarLink } from "./connect-calendar-link";

const POINTS = [
  { Icon: CheckIcon, text: "Events that carry a room link show their room" },
  {
    Icon: LockSimpleIcon,
    text: "Campus only reads your calendar. It never creates or changes an event.",
  },
  { Icon: EyeSlashIcon, text: "Other events show only as “Busy”" },
] as const;

// What the member sees before a calendar is connected. It promises only what
// campus does: it reads, it does not write, and it sends no reminders.
export function CalendarConnectCard() {
  return (
    <section
      aria-labelledby="calendar-connect-heading"
      className="bg-shell-panel border-shell-line grid w-full max-w-md justify-items-center gap-4 rounded-2xl border p-6 text-center"
    >
      <div className="bg-surface-hover text-primary grid size-14 place-items-center rounded-full">
        <CalendarBlankIcon aria-hidden size={26} weight="regular" />
      </div>
      <h2
        id="calendar-connect-heading"
        className="font-display text-2xl font-bold"
      >
        Connect Google Calendar
      </h2>
      <p className="text-foreground-secondary text-pretty">
        See your classes, meetings and Town Halls here, and go to the room when
        one is open.
      </p>
      <ul className="bg-surface-hover grid w-full gap-3 rounded-xl p-4 text-left text-sm">
        {POINTS.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
            {text}
          </li>
        ))}
      </ul>
      <ConnectCalendarLink className="w-full" />
    </section>
  );
}
