"use client";

import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui/popover";

import { useDisconnectCalendar } from "../hooks/use-disconnect-calendar";

// The gear in the panel header. It holds the one setting there is, with the
// words that say what it does, so pressing Disconnect is already the
// confirmation.
export function DisconnectCalendarMenu() {
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectCalendar();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Calendar settings"
        render={<Button variant="ghost" size="icon-sm" />}
        className="text-icon-muted hover:text-icon shrink-0"
      >
        <GearSixIcon aria-hidden size={18} weight="regular" />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-3">
        <PopoverTitle>Google Calendar</PopoverTitle>
        <p className="text-foreground-secondary text-sm text-pretty">
          Disconnecting stops campus reading your calendar and removes it from
          your Google account&rsquo;s connections.
        </p>
        <Button
          variant="destructive"
          disabled={disconnect.isPending}
          onClick={() =>
            disconnect.mutate(undefined, { onSettled: () => setOpen(false) })
          }
        >
          {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
