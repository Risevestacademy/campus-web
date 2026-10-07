"use client";

import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { LockOpenIcon } from "@phosphor-icons/react/dist/ssr/LockOpen";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/ssr/SidebarSimple";
import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

import { toggleSidebar } from "../store/sidebar-store";

const participantToneClassNames = [
  "bg-cobalt-200 dark:bg-cobalt-800",
  "bg-lemon-200 dark:bg-lemon-800",
] as const;

export type MeetingParticipant = Readonly<{
  id: string;
  initials: string;
  name: string;
}>;

type MeetingHeaderProps = Readonly<{
  title: string;
  participants: readonly MeetingParticipant[];
  remainingParticipantCount?: number;
}>;

type MeetingParticipantStackProps = Pick<
  MeetingHeaderProps,
  "participants" | "remainingParticipantCount"
>;

function MeetingParticipantStack({
  participants,
  remainingParticipantCount = 0,
}: MeetingParticipantStackProps) {
  return (
    <div className="flex *:grid *:size-6.5 *:place-items-center *:rounded-full *:border *:text-xs *:font-medium">
      {participants.map((participant, index) => (
        <span
          key={participant.id}
          role="img"
          aria-label={participant.name}
          className={cn(
            "border-border",
            index > 0 && "-ml-2",
            participantToneClassNames[index % participantToneClassNames.length],
          )}
        >
          {participant.initials}
        </span>
      ))}

      {remainingParticipantCount > 0 && (
        <span
          role="img"
          aria-label={`${remainingParticipantCount} more participants`}
          className="bg-turquoise-200 dark:bg-turquoise-800 border-border -ml-2"
        >
          +{remainingParticipantCount}
        </span>
      )}
    </div>
  );
}

function MeetingLockToggle() {
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

export function MeetingHeader({
  title,
  participants,
  remainingParticipantCount = 0,
}: MeetingHeaderProps) {
  return (
    <header className="flex h-fit items-center gap-3">
      <Button
        type="button"
        data-surface-role="surface-elevated"
        size="icon"
        variant="ghost"
        aria-label="Open sidebar"
        title="Open sidebar"
        onClick={toggleSidebar}
        className="bg-surface-elevated border-border size-10 rounded-xl border [&_svg:not([class*='size-'])]:size-5"
      >
        <SidebarSimpleIcon aria-hidden />
      </Button>

      <div className="flex items-center gap-1.5">
        <MeetingParticipantStack
          participants={participants}
          remainingParticipantCount={remainingParticipantCount}
        />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>

      <MeetingLockToggle />
    </header>
  );
}
