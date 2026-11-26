"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import Link from "next/link";

import { Button, buttonVariants } from "@/shared/ui/button";
import { PopoverTitle } from "@/shared/ui/popover";
import { toast } from "@/shared/ui/toast";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import {
  eventTimeLabel,
  eventTitle,
  formatDayLong,
} from "../services/calendar-labels";
import { boundsOf, isLive } from "../services/calendar-time";
import { roomHref } from "../services/room-href";

const ANSWERS = {
  accepted: "You accepted",
  tentative: "You said maybe",
  declined: "You declined",
  needsAction: "You haven’t answered",
} as const;

// What opens when an event is pressed. An event with no room of this cohort
// is only a time: it has nothing else to show.
export function EventDetails({
  event,
  now,
}: Readonly<{ event: CalendarEvent; now: Date }>) {
  const when = `${formatDayLong(boundsOf(event).start)}, ${eventTimeLabel(event)}`;

  if (event.kind === "busy") {
    return (
      <div className="grid gap-1">
        <PopoverTitle>Busy · From Google</PopoverTitle>
        <p className="text-foreground-secondary text-sm">{when}</p>
      </div>
    );
  }

  const live = isLive(event, now);
  const href = roomHref(event.room.code);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <PopoverTitle className="text-pretty break-words">
          {eventTitle(event)}
        </PopoverTitle>
        <p className="text-foreground-secondary text-sm">{when}</p>
        <p className="text-sm">Room: {event.room.spaceName}</p>
        {event.location ? (
          <p className="text-foreground-secondary text-sm break-words">
            {event.location}
          </p>
        ) : null}
        {event.response ? (
          <p className="text-foreground-secondary text-sm">
            {ANSWERS[event.response]}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={href}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          {live ? "Join" : "Go to room"}
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyRoomLink(event.room.code)}
        >
          <CopyIcon aria-hidden data-icon="inline-start" />
          Copy room link
        </Button>
        {event.googleUrl ? (
          <a
            href={event.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Open in Google Calendar
            <ArrowSquareOutIcon aria-hidden data-icon="inline-end" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

async function copyRoomLink(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(
      `${window.location.origin}${roomHref(code)}`,
    );
    toast.add({ title: "Room link copied.", type: "success" });
  } catch {
    toast.add({ title: "We couldn't copy the link.", type: "warning" });
  }
}
