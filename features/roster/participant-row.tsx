import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { HandIcon } from "@phosphor-icons/react/dist/ssr/Hand";
import { NavigationArrowIcon } from "@phosphor-icons/react/dist/ssr/NavigationArrow";
import { cn } from "cn";

import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/ui/avatar";
import { buttonVariants } from "@/shared/ui/button";

import type { Participant } from "./types";

const rowActions = [
  { label: "Wave", Icon: HandIcon },
  { label: "Go to", Icon: NavigationArrowIcon },
  { label: "Message", Icon: ChatCircleIcon },
];

export function ParticipantRow({ participant }: { participant: Participant }) {
  return (
    <li className="group/row flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]">
      <Avatar>
        <AvatarFallback className={participant.avatarClassName}>
          {participant.initial}
        </AvatarFallback>
        <AvatarBadge
          className={participant.status === "busy" ? "bg-error" : "bg-success"}
        />
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">
          {participant.name}
        </p>
        <p className="text-foreground-secondary truncate text-xs">
          {participant.detail}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-1 group-hover/row:flex">
        {rowActions.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            aria-label={`${label} ${participant.name}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "hover:bg-background rounded-full text-[#2443B3] dark:text-[#9DADE7] dark:hover:bg-[#1F2940]",
            )}
          >
            <Icon aria-hidden size={14} weight="regular" />
          </button>
        ))}
      </div>
    </li>
  );
}
