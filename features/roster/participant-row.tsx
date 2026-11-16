"use client";

import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { HandIcon } from "@phosphor-icons/react/dist/ssr/Hand";
import { NavigationArrowIcon } from "@phosphor-icons/react/dist/ssr/NavigationArrow";
import { cn } from "cn";
import { type ReactNode, useState } from "react";

import { keepFocus } from "@/shared/lib/keep-focus";
import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

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

// The card lays them out as the design does: Go to last, as the main action.
const cardActions = [rowActions[0], rowActions[2], rowActions[1]] as const;

export type RenderProfileCard = (
  participant: Participant,
  card: {
    presence: { badgeClassName: string; label: string };
    actions?: ReactNode;
  },
) => ReactNode;

function canAct(participant: Participant) {
  return participant.status !== "offline" && !participant.isSelf;
}

function presenceLabelOf(participant: Participant) {
  if (participant.status === "offline") return "Offline";
  return participant.detail || "Available";
}

export function ParticipantRow({
  onAction,
  participant,
  renderProfileCard,
}: {
  onAction?: (action: ParticipantAction, participant: Participant) => void;
  participant: Participant;
  renderProfileCard?: RenderProfileCard;
}) {
  const [isCardOpen, setIsCardOpen] = useState(false);
  const who = (
    <>
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
    </>
  );

  return (
    <li className="group/row flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]">
      {renderProfileCard ? (
        <Popover open={isCardOpen} onOpenChange={setIsCardOpen}>
          <PopoverTrigger
            aria-label={`View ${participant.name}'s profile`}
            className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2"
          >
            {who}
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={16}
            className="w-80 p-4"
          >
            {isCardOpen
              ? renderProfileCard(participant, {
                  presence: {
                    badgeClassName: BADGE_CLASS_NAMES[participant.status],
                    label: presenceLabelOf(participant),
                  },
                  actions: canAct(participant) ? (
                    <div className="grid grid-cols-3 gap-2">
                      {cardActions.map(({ action, label, Icon }) => (
                        <Button
                          key={action}
                          type="button"
                          variant={action === "go-to" ? "default" : "outline"}
                          size="xs"
                          onClick={() => {
                            if (action === "go-to") setIsCardOpen(false);
                            onAction?.(action, participant);
                          }}
                        >
                          <Icon aria-hidden size={14} />
                          {label}
                        </Button>
                      ))}
                    </div>
                  ) : undefined,
                })
              : null}
          </PopoverContent>
        </Popover>
      ) : (
        who
      )}

      {canAct(participant) && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100">
          {rowActions.map(({ action, label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={`${label} ${participant.name}`}
              onClick={() => onAction?.(action, participant)}
              onMouseDown={keepFocus}
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
