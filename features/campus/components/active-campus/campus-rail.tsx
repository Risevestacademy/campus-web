"use client";

import { ChatCenteredDotsIcon } from "@phosphor-icons/react/dist/ssr/ChatCenteredDots";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun";
import { cn } from "cn";
import Image from "next/image";
import type { ReactNode } from "react";

import logoMark from "@/assets/icon-inverse.svg";
import { badgeVariants } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { useThemeToggle } from "@/shared/ui/theme-toggle/use-theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { useActivePanel } from "../../hooks/use-shell-state";
import { setActivePanel } from "../../store/shell-store";
import { railPanelItems } from "./rail-items";

function RailButton({
  label,
  isActive,
  isPressed,
  badgeCount,
  onClick,
  children,
}: {
  label: string;
  isActive?: boolean;
  isPressed?: boolean;
  badgeCount?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        aria-pressed={isPressed}
        onClick={onClick}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-lg" }),
          "text-primary-foreground/70 not-aria-[current=page]:hover:bg-primary-foreground/10 not-aria-[current=page]:hover:text-primary-foreground aria-[current=page]:bg-cobalt-700 dark:aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground relative",
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

function ThemeRailButton() {
  const { isDark, label, toggle } = useThemeToggle();
  const Icon = isDark ? SunIcon : MoonIcon;

  return (
    <RailButton label={label} isPressed={isDark} onClick={toggle}>
      <Icon aria-hidden size="1.3rem" weight="bold" />
    </RailButton>
  );
}

export function CampusRail({ account }: { account: ReactNode }) {
  const activePanel = useActivePanel();

  return (
    <nav
      aria-label="Campus"
      data-theme-toggle-host
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
        <ThemeRailButton />
        <RailButton label="Settings">
          <GearSixIcon aria-hidden size="1.3rem" weight="bold" />
        </RailButton>
        <div className="mt-2 flex">{account}</div>
      </div>
    </nav>
  );
}
