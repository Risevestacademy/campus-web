"use client";

import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { LockOpenIcon } from "@phosphor-icons/react/dist/ssr/LockOpen";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

export function MeetingLockToggle() {
  const [isLocked, setIsLocked] = useState(false);
  const title = isLocked ? "Unlock meeting" : "Lock meeting";

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label="Meeting lock"
      aria-pressed={isLocked}
      data-meeting-locked={isLocked ? "" : undefined}
      title={title}
      onClick={() => setIsLocked((previous) => !previous)}
      className="group/meeting-lock data-meeting-locked:hover:bg-error/20 data-meeting-locked:border-error/30 data-meeting-locked:bg-error/10 data-meeting-locked:text-error-icon bg-surface-elevated border-border size-10 rounded-xl border transition-[background-color,color,scale,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:transition-none active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span aria-hidden className="relative block size-5 shrink-0">
        <LockOpenIcon
          data-slot="lock-open-icon"
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/meeting-lock:transition-none group-data-meeting-locked/meeting-lock:scale-[0.92] group-data-meeting-locked/meeting-lock:opacity-0 motion-reduce:transition-none"
        />
        <LockIcon
          data-slot="lock-icon"
          focusable="false"
          weight="regular"
          className="absolute inset-0 size-full scale-[0.92] opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible/meeting-lock:transition-none group-data-meeting-locked/meeting-lock:scale-100 group-data-meeting-locked/meeting-lock:opacity-100 motion-reduce:transition-none"
        />
      </span>
    </Button>
  );
}
