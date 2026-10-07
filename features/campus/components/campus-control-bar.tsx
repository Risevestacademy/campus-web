import { ArrowBendUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowBendUpRight";
import { ChatIcon } from "@phosphor-icons/react/dist/ssr/Chat";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { MonitorArrowUpIcon } from "@phosphor-icons/react/dist/ssr/MonitorArrowUp";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { cn } from "cn";
import Link from "next/link";

import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { Button, buttonVariants } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import { Separator } from "@/shared/ui/separator";

import { MediaControls } from "./media-controls";

type PresenceStatus = "active" | "busy" | "away";

const presenceStatusConfig = {
  active: {
    badgeClassName: "bg-success",
    label: "Active",
  },
  busy: {
    badgeClassName: "bg-warning",
    label: "Busy",
  },
  away: {
    badgeClassName: "border-warning-icon border-2 bg-transparent",
    label: "Away",
  },
} satisfies Record<PresenceStatus, { badgeClassName: string; label: string }>;

const campusActions = [
  { Icon: MonitorArrowUpIcon, label: "Share screen" },
  { Icon: ChatIcon, label: "Open chat" },
  { Icon: HandPalmIcon, label: "Raise hand" },
] as const;

type CampusControlBarProps = Readonly<{
  initials: string;
  status: PresenceStatus;
}>;

function PresenceMenuTrigger({ initials, status }: CampusControlBarProps) {
  const statusConfig = presenceStatusConfig[status];

  return (
    <Button
      type="button"
      size="icon-sm"
      aria-label={`Open presence settings. Current status: ${statusConfig.label}`}
      title={`Presence: ${statusConfig.label}`}
      className="bg-primary hover:bg-primary/80 p-0"
    >
      <Avatar size="lg" className="dark:after:border-transparent">
        <AvatarFallback className="bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
        <AvatarBadge className={statusConfig.badgeClassName}>
          <span className="sr-only">{statusConfig.label}</span>
        </AvatarBadge>
      </Avatar>
    </Button>
  );
}

function CampusActionControls() {
  return (
    <div role="group" aria-label="Campus actions" className="flex gap-1.25">
      {campusActions.map(({ Icon, label }) => (
        <Button
          key={label}
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          title={label}
          className="bg-surface hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5"
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}

function BackToCampusesControl() {
  return (
    <Link
      href="/campus"
      aria-label="Back to campuses"
      title="Back to campuses"
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "bg-surface hover:ring-primary hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5",
      )}
    >
      <ArrowBendUpRightIcon aria-hidden />
    </Link>
  );
}

function ZoomControls() {
  return (
    <ButtonGroup
      orientation="vertical"
      aria-label="Zoom controls"
      className="ml-auto"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Zoom in"
        title="Zoom in"
        className="bg-surface-elevated"
      >
        <PlusIcon aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Zoom out"
        title="Zoom out"
        className="bg-surface-elevated"
      >
        <MinusIcon aria-hidden />
      </Button>
    </ButtonGroup>
  );
}

export function CampusControlBar({ initials, status }: CampusControlBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end">
      <div className="bg-background col-start-2 flex items-center gap-1.5 rounded-l-[1.25rem] rounded-r-[1.125rem] py-1.5 pr-1.75 pl-2">
        <PresenceMenuTrigger initials={initials} status={status} />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <MediaControls className="gap-1.5" />
        <CampusActionControls />
        <Separator orientation="vertical" className="mx-1.5 my-auto h-6" />
        <BackToCampusesControl />
      </div>

      <ZoomControls />
    </div>
  );
}
