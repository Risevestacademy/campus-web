"use client";

import { cn } from "cn";
import { type ReactNode, useId, useRef, useState } from "react";

import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { Separator } from "@/shared/ui/separator";

import { useStatusChoice } from "../hooks/use-status-choice";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { PresenceMenuTrigger } from "./presence-menu-trigger";
import { StatusTray } from "./status-tray";

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
  const choice = useStatusChoice(cohortId);

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
            canChoose={choice.canChoose}
            durationId={choice.durationId}
            onDurationChange={choice.chooseDuration}
            onStatusChange={choice.chooseStatus}
            stacked={stackedTray}
            status={choice.status}
            timeLeft={choice.timeLeft}
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
          status={choice.status}
          timeLeft={choice.timeLeft}
        />
        {children}
      </div>
    </div>
  );
}
