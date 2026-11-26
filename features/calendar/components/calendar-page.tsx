"use client";

import { CalendarCheckIcon } from "@phosphor-icons/react/dist/ssr/CalendarCheck";

import { Button } from "@/shared/ui/button";

import { useCalendarStatus } from "../hooks/use-calendar-status";
import { CalendarConnectCard } from "./calendar-connect-card";

// The calendar's main area. Until the week arrives it shows where the member
// stands: asking Google, not connected, or connected.
export function CalendarPage() {
  const { data, isPending, refetch } = useCalendarStatus();

  return (
    <div className="grid min-h-full place-items-center p-6">
      {isPending ? (
        <p className="text-foreground-secondary" role="status">
          Checking Google Calendar…
        </p>
      ) : data?.kind === "not-connected" ? (
        <CalendarConnectCard />
      ) : data?.kind === "connected" ? (
        <div className="grid max-w-sm justify-items-center gap-3 text-center">
          <div className="bg-surface-hover text-primary grid size-14 place-items-center rounded-full">
            <CalendarCheckIcon aria-hidden size={26} />
          </div>
          <h2 className="font-display text-2xl font-bold">
            Your calendar is connected
          </h2>
          <p className="text-foreground-secondary text-pretty">
            Your week shows here soon, with the rooms to join.
          </p>
        </div>
      ) : (
        <div
          role="alert"
          className="grid max-w-sm justify-items-center gap-3 text-center"
        >
          <h2 className="font-display text-2xl font-bold">
            {data?.kind === "signed-out"
              ? "Your session ran out"
              : "Google Calendar didn’t answer."}
          </h2>
          <p className="text-foreground-secondary text-pretty">
            {data?.kind === "signed-out"
              ? "Sign in and try again."
              : "Try again in a moment."}
          </p>
          {data?.kind === "signed-out" ? null : (
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
