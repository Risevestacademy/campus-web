import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { HandIcon } from "@phosphor-icons/react/dist/ssr/Hand";
import { NavigationArrowIcon } from "@phosphor-icons/react/dist/ssr/NavigationArrow";
import { cn } from "cn";

import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { buttonVariants } from "@/shared/ui/button";

import type { Participant, ParticipantAction } from "./types";

const BADGE_CLASS_NAMES = {
  available: "bg-success",
  busy: "bg-error",
  away: "bg-warning",
  offline: "bg-icon-muted",
} as const;

const rowActions = [
  { action: "wave", label: "Wave", Icon: HandIcon },
  { action: "go-to", label: "Go to", Icon: NavigationArrowIcon },
  { action: "message", label: "Message", Icon: ChatCircleIcon },
] as const;

export function ParticipantRow({
  onAction,
  participant,
}: {
  onAction?: (action: ParticipantAction, participant: Participant) => void;
  participant: Participant;
}) {
  return (
    <li className="group/row flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]">
      <Avatar>
        <AvatarFallback className={participant.avatarClassName}>
          {participant.initial}
        </AvatarFallback>
        <AvatarBadge className={BADGE_CLASS_NAMES[participant.status]} />
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">
          {participant.name}
        </p>
        {participant.detail && (
          <p className="text-foreground-secondary truncate text-xs">
            {participant.detail}
          </p>
        )}
      </div>

      {participant.status !== "offline" && (
        <div className="hidden shrink-0 items-center gap-1 group-hover/row:flex">
          {rowActions.map(({ action, label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={`${label} ${participant.name}`}
              onClick={() => onAction?.(action, participant)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                "hover:bg-background rounded-full text-[#2443B3] dark:text-[#9DADE7] dark:hover:bg-[#1F2940]",
              )}
            >
              <Icon aria-hidden size={14} weight="regular" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
