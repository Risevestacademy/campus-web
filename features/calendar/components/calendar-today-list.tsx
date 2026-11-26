"use client";

import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { eventTimeLabel, eventTitle } from "../services/calendar-labels";
import { isLive } from "../services/calendar-time";
import { roomHref } from "../services/room-href";

// Today's events that carry a room, with Join on the one that is open.
export function CalendarTodayList({
  events,
  now,
}: Readonly<{ events: readonly CalendarEvent[]; now: Date }>) {
  return (
    <section aria-label="Today" className="grid gap-2">
      <h3 className="text-sm font-semibold">Today</h3>
      {events.length === 0 ? (
        <p className="text-foreground-secondary text-sm">Nothing today.</p>
      ) : (
        <ul className="grid gap-2">
          {events.map((event) =>
            event.kind === "campus" ? (
              <li
                key={event.id}
                className="bg-surface-hover flex items-center gap-2 rounded-lg p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {eventTitle(event)}
                  </p>
                  <p className="text-foreground-secondary truncate text-xs">
                    {eventTimeLabel(event)} · {event.room.spaceName}
                  </p>
                </div>
                {isLive(event, now) ? (
                  <Link
                    href={roomHref(event.room.code)}
                    className={buttonVariants({ size: "xs" })}
                  >
                    <span aria-hidden className="font-bold">
                      LIVE ·{" "}
                    </span>
                    Join<span className="sr-only">, {eventTitle(event)}</span>
                  </Link>
                ) : null}
              </li>
            ) : null,
          )}
        </ul>
      )}
    </section>
  );
}
