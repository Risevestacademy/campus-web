"use client";

import { cn } from "cn";
import { type ReactNode, useId, useRef, useState } from "react";

import { presenceFor, statusTimeLeft } from "@/core/presence";
import { socialFor } from "@/core/realtime";
import { initialsOf } from "@/shared/lib/initials";
import { useNow } from "@/shared/lib/use-now";
import { Separator } from "@/shared/ui/separator";

import { useOwnStatus } from "../hooks/use-own-status";
import { participantTone } from "../services/meeting/participant-identity";
import {
  chooseStatus,
  type ChosenStatus,
} from "../services/status-choice/choose-status";
import {
  durationRefusalOf,
  durationSecondsOf,
  STATUS_DURATIONS,
  type StatusDurationId,
} from "../services/status-choice/status-durations";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { PresenceMenuTrigger } from "./presence-menu-trigger";
import { StatusTray } from "./status-tray";

const CLOCK_TICK_MS = 15_000;

type StatusDockProps = Readonly<{
  children: ReactNode;
  className?: string;
  cohortId: string;
  rowClassName?: string;
  viewer: CampusViewer;
}>;

function refusalsAt(now: number): Partial<Record<StatusDurationId, string>> {
  const at = new Date(now);
  const refusals: Partial<Record<StatusDurationId, string>> = {};
  for (const { id } of STATUS_DURATIONS) {
    const refusal = durationRefusalOf(durationSecondsOf(id, at));
    if (refusal) refusals[id] = refusal;
  }
  return refusals;
}

// The dock grows a tray above its row: the member's status sits with the
// controls it belongs to instead of floating over the map.
export function StatusDock({
  children,
  className,
  cohortId,
  rowClassName,
  viewer,
}: StatusDockProps) {
  const trayId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [durationId, setDurationId] = useState<StatusDurationId>("lasting");
  const { status, statusUntil, synced } = useOwnStatus(cohortId);
  const now = useNow(CLOCK_TICK_MS);
  const timeLeft = statusTimeLeft(statusUntil, now);

  function choose(next: ChosenStatus, forSeconds?: number) {
    return chooseStatus(
      {
        social: socialFor(cohortId),
        drawOwnStatus: presenceFor(cohortId).getState().drawOwnStatus,
        now: Date.now,
      },
      next,
      forSeconds,
    );
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      className={cn("flex flex-col", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) close();
      }}
    >
      {open ? (
        <>
          <StatusTray
            id={trayId}
            canChoose={synced}
            durationId={
              timeLeft === null
                ? "lasting"
                : durationId === "lasting"
                  ? null
                  : durationId
            }
            onDurationChange={(next) => {
              if (choose(status, durationSecondsOf(next, new Date()))) {
                setDurationId(next);
              }
            }}
            onStatusChange={(next) => {
              if (choose(next)) setDurationId("lasting");
            }}
            refusals={refusalsAt(now)}
            status={status}
            timeLeft={timeLeft}
          />
          <Separator className="mx-3.5 w-auto data-horizontal:w-auto" />
        </>
      ) : null}
      <div className={rowClassName}>
        <PresenceMenuTrigger
          ref={triggerRef}
          aria-controls={open ? trayId : undefined}
          aria-expanded={open}
          initials={initialsOf(viewer.displayName)}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          status={status}
          timeLeft={timeLeft}
          tone={participantTone(viewer.id)}
        />
        {children}
      </div>
    </div>
  );
}
