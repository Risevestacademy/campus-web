"use client";

import { cn } from "cn";
import { type ReactNode, useId, useRef, useState } from "react";

import { presenceFor, statusTimeLeft } from "@/core/presence";
import { socialFor } from "@/core/realtime";
import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { useNow } from "@/shared/lib/use-now";
import { Separator } from "@/shared/ui/separator";

import { useOwnStatus } from "../hooks/use-own-status";
import {
  chooseStatus,
  type ChosenStatus,
} from "../services/status-choice/choose-status";
import {
  durationSecondsOf,
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
  stackedTray?: boolean;
  viewer: CampusViewer;
}>;

// The dock grows a tray above its row: the member's status sits with the
// controls it belongs to instead of floating over the map.
export function StatusDock({
  children,
  className,
  cohortId,
  rowClassName,
  stackedTray = false,
  viewer,
}: StatusDockProps) {
  const trayId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [durationId, setDurationId] = useState<StatusDurationId | null>(null);
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
            durationId={timeLeft === null ? null : durationId}
            onDurationChange={(next) => {
              const forSeconds =
                next === null ? undefined : durationSecondsOf(next);
              if (choose(status, forSeconds)) setDurationId(next);
            }}
            onStatusChange={(next) => {
              if (choose(next)) setDurationId(null);
            }}
            stacked={stackedTray}
            status={status}
            timeLeft={timeLeft}
          />
          <Separator className="mx-3.5 mb-1 w-auto data-horizontal:w-auto" />
        </>
      ) : null}
      <div className={rowClassName}>
        <PresenceMenuTrigger
          ref={triggerRef}
          aria-controls={open ? trayId : undefined}
          aria-expanded={open}
          avatarClassName={avatarToneOf(viewer.id)}
          initial={initialOf(viewer.displayName)}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          status={status}
          timeLeft={timeLeft}
        />
        {children}
      </div>
    </div>
  );
}
