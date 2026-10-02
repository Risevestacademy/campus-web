"use client";

import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/ssr/SidebarSimple";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import { MeetingLockToggle } from "./meeting-lock-toggle";

const participantToneClassNames = [
  "bg-cobalt-200 dark:bg-cobalt-800",
  "bg-lemon-200 dark:bg-lemon-800",
] as const;

export type MeetingParticipant = Readonly<{
  id: string;
  initials: string;
  name: string;
}>;

export type MeetingHeaderProps = Readonly<{
  title: string;
  participants: readonly MeetingParticipant[];
  remainingParticipantCount?: number;
  onOpenSidebar?: () => void;
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

export function MeetingHeader({
  title,
  participants,
  remainingParticipantCount = 0,
  onOpenSidebar,
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
        onClick={onOpenSidebar}
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
