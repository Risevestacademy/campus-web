"use client";

import { cn } from "cn";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import {
  eventAccessibleName,
  eventTimeLabel,
  eventTitle,
} from "../services/calendar-labels";
import { isLive } from "../services/calendar-time";
import { roomHref } from "../services/room-href";
import { EventDetails } from "./event-details";

// One event as a block or a chip. It is a button that opens the details, and
// an event with a room that is open has LIVE and a Join link beside it, so the
// way in is one press away.
export function CalendarEventBlock({
  event,
  now,
  style,
  compact = false,
  className,
}: Readonly<{
  event: CalendarEvent;
  now: Date;
  style?: CSSProperties;
  compact?: boolean;
  className?: string;
}>) {
  const live = isLive(event, now);
  const declined = event.response === "declined";

  return (
    <Popover>
      <div
        style={style}
        data-live={live || undefined}
        className={cn(
          "flex items-start gap-1 overflow-hidden rounded-md border-l-4 text-xs",
          event.kind === "busy"
            ? "bg-surface-hover text-foreground-secondary border-border-strong"
            : "bg-info-subtle text-foreground border-info-border",
          event.status === "tentative" && "border-dashed",
          declined && "text-foreground-secondary",
          className,
        )}
      >
        <PopoverTrigger
          aria-label={eventAccessibleName(event)}
          className={cn(
            "focus-visible:ring-ring min-w-0 flex-1 cursor-pointer px-1.5 py-0.5 text-left outline-none focus-visible:ring-2",
            compact ? "truncate" : "grid",
          )}
        >
          <span
            className={cn("truncate font-medium", declined && "line-through")}
          >
            {live ? <span className="font-bold">LIVE · </span> : null}
            {eventTitle(event)}
          </span>
          {compact ? null : (
            <span className="text-foreground-secondary truncate">
              {eventTimeLabel(event)}
            </span>
          )}
        </PopoverTrigger>
        {live && event.kind === "campus" ? (
          <Link
            href={roomHref(event.room.code)}
            className="bg-primary text-primary-foreground focus-visible:ring-ring m-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold outline-none focus-visible:ring-2"
          >
            Join<span className="sr-only">, {eventTitle(event)}</span>
          </Link>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-80">
        <EventDetails event={event} now={now} />
      </PopoverContent>
    </Popover>
  );
}
