"use client";

import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { cn } from "cn";

import { buttonVariants } from "@/shared/ui/button";

import {
  CONNECT_CALENDAR_HREF,
  useConnectCalendar,
} from "../hooks/use-connect-calendar";

// A plain link, since connecting leaves the app for Google. It renews the
// session first; opened in a new tab it just goes.
export function ConnectCalendarLink({
  className,
}: Readonly<{ className?: string }>) {
  const { connect, leaving } = useConnectCalendar();

  return (
    <a
      href={CONNECT_CALENDAR_HREF}
      onClick={(event) => void connect(event)}
      aria-disabled={leaving || undefined}
      className={cn(
        buttonVariants({ size: "lg" }),
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        className,
      )}
    >
      <CalendarBlankIcon aria-hidden weight="bold" />
      Connect Google Calendar
    </a>
  );
}
