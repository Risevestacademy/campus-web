import { cn } from "cn";
import type { ComponentProps } from "react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";

import type { ChosenStatus } from "../services/status-choice/choose-status";
import { STATUS_BADGE_CLASS_NAMES, STATUS_LABELS } from "./status-appearance";

type PresenceMenuTriggerProps = Readonly<
  Omit<ComponentProps<typeof Button>, "children"> & {
    avatarClassName: string;
    initial: string;
    status: ChosenStatus;
    timeLeft?: string | null;
  }
>;

export function PresenceMenuTrigger({
  avatarClassName,
  className,
  initial,
  status,
  timeLeft = null,
  ...props
}: PresenceMenuTriggerProps) {
  const label = timeLeft
    ? `${STATUS_LABELS[status]}, ${timeLeft} left`
    : STATUS_LABELS[status];

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={`Your status: ${label}`}
      title={`Your status: ${label}`}
      className={cn(
        "ring-offset-background aria-expanded:ring-primary rounded-full p-0 aria-expanded:ring-2 aria-expanded:ring-offset-2",
        className,
      )}
      {...props}
    >
      <Avatar size="lg" className="dark:after:border-transparent">
        <AvatarFallback className={cn("font-medium", avatarClassName)}>
          {initial}
        </AvatarFallback>
        <AvatarBadge className={STATUS_BADGE_CLASS_NAMES[status]} />
      </Avatar>
    </Button>
  );
}
