"use client";

import { ChatCenteredDotsIcon } from "@phosphor-icons/react/dist/ssr/ChatCenteredDots";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { cn } from "cn";
import Image from "next/image";
import { useSyncExternalStore } from "react";

import logoMark from "@/assets/icon-inverse.svg";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { badgeVariants } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { railPanelItems } from "./rail-items";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  setActivePanel,
  subscribeToShell,
} from "./shell-store";

/** Current user's initial, until the profile feature owns this. */
const CURRENT_USER_INITIAL = "J";

function RailButton({
  label,
  isActive,
  badgeCount,
  onClick,
  children,
}: {
  label: string;
  isActive?: boolean;
  badgeCount?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-lg" }),
          "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground relative",
        )}
      >
        {children}
        {badgeCount ? (
          <span
            className={cn(
              badgeVariants({ variant: "destructive" }),
              "absolute top-1 right-1 h-4 min-w-4 rounded-full border-0 bg-[#D63941] p-0 text-[10px] text-[#F7F7F7] dark:bg-[#D63941] dark:text-[#F7F7F7]",
            )}
          >
            {badgeCount}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function CampusRail() {
  const activePanel = useSyncExternalStore(
    subscribeToShell,
    getActivePanelSnapshot,
    getServerActivePanelSnapshot,
  );

  return (
    <nav
      aria-label="Campus"
      className="bg-primary dark:bg-cobalt-900 flex w-16 shrink-0 flex-col items-center justify-between rounded-xl py-4"
    >
      <div className="flex flex-col items-center gap-4">
        <Image
          src={logoMark}
          alt="Campus by Rise"
          width={30}
          height={46}
          className="size-8 object-contain"
        />
        <Separator className="bg-primary-foreground/15 w-8" />
        <div className="flex flex-col items-center gap-1">
          {railPanelItems.map((item) => (
            <RailButton
              key={item.id}
              label={item.label}
              isActive={activePanel === item.id}
              badgeCount={item.badgeCount}
              onClick={() => setActivePanel(item.id)}
            >
              <item.Icon
                aria-hidden
                size="1.3rem"
                weight={activePanel === item.id ? "fill" : "bold"}
              />
            </RailButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <RailButton label="Report an issue">
          <ChatCenteredDotsIcon aria-hidden size="1.3rem" weight="bold" />
        </RailButton>
        <RailButton label="Settings">
          <GearSixIcon aria-hidden size="1.3rem" weight="bold" />
        </RailButton>
        <Avatar size="lg" className="mt-2">
          <AvatarFallback className="bg-accent text-accent-foreground font-medium">
            {CURRENT_USER_INITIAL}
          </AvatarFallback>
        </Avatar>
      </div>
    </nav>
  );
}
