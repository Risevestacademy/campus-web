"use client";

import { ChatCenteredDotsIcon } from "@phosphor-icons/react/dist/ssr/ChatCenteredDots";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { cn } from "cn";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import logoMark from "@/assets/icon-inverse.svg";
import { useAnalyticsConsent } from "@/core/analytics/consent";
import { campusHref } from "@/core/navigation";
import { badgeVariants } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { useActivePanel, useSidebarMode } from "../../hooks/use-sidebar-state";
import { openFeedbackPanel } from "../../store/feedback-panel-store";
import type { SidebarMode } from "../../store/sidebar-preferences";
import { useCampusView } from "../campus-view-provider";
import { SettingsDialog } from "../settings/settings-dialog";
import type { LogOutActionComponent } from "./log-out-confirm-dialog";
import { railPanelItems } from "./rail-items";

export type { LogOutActionComponent } from "./log-out-confirm-dialog";

function RailButton({
  label,
  isActive,
  isPressed,
  disabled,
  badgeCount,
  href,
  onClick,
  children,
}: {
  label: string;
  isActive?: boolean;
  isPressed?: boolean;
  disabled?: boolean;
  badgeCount?: number;
  href?: Route;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={href ? <Link href={href} /> : undefined}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        aria-pressed={isPressed}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-lg" }),
          "text-primary-foreground/70 not-aria-[current=page]:hover:bg-primary-foreground/10 not-aria-[current=page]:hover:text-primary-foreground aria-[current=page]:bg-cobalt-700 dark:aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground relative aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-5.5",
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

// The rail hides the floating Privacy choices control, so it offers its own.
function PrivacyRailButton() {
  const { canReopen, isOpen, toggle } = useAnalyticsConsent();

  if (!canReopen) return null;

  return (
    <RailButton label="Privacy choices" isPressed={isOpen} onClick={toggle}>
      <ShieldCheckIcon aria-hidden size="1.3rem" weight="bold" />
    </RailButton>
  );
}

function SettingsRailButton({
  LogOutAction,
}: {
  LogOutAction?: LogOutActionComponent;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <RailButton
        label="Settings"
        isPressed={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <GearSixIcon aria-hidden size="1.3rem" weight="bold" />
      </RailButton>
      <SettingsDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        LogOutAction={LogOutAction}
      />
    </>
  );
}

export function CampusRail({
  account,
  cohortId,
  hasAdministration = false,
  initialSidebarMode,
  LogOutAction,
}: {
  account: ReactNode;
  cohortId: string;
  hasAdministration?: boolean;
  initialSidebarMode?: SidebarMode;
  LogOutAction?: LogOutActionComponent;
}) {
  const activePanel = useActivePanel();
  const sidebarMode = useSidebarMode(initialSidebarMode, hasAdministration);
  const { openAdministration, openPanel } = useCampusView();
  const mapHref = campusHref(cohortId);

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
          {hasAdministration ? (
            <RailButton
              label="Administration"
              isActive={sidebarMode === "admin"}
              onClick={openAdministration}
            >
              <SquaresFourIcon aria-hidden />
            </RailButton>
          ) : null}
          {railPanelItems.map((item) => (
            <RailButton
              key={item.id}
              label={item.label}
              isActive={sidebarMode === "campus" && activePanel === item.id}
              badgeCount={item.badgeCount}
              href={item.id === "map" ? mapHref : undefined}
              onClick={() => openPanel(item.id)}
            >
              <item.Icon
                aria-hidden
                // weight={activePanel === item.id ? "fill" : "bold"}
              />
            </RailButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <RailButton label="Report an issue" onClick={openFeedbackPanel}>
          <ChatCenteredDotsIcon aria-hidden size="1.3rem" weight="bold" />
        </RailButton>
        <PrivacyRailButton />
        <SettingsRailButton LogOutAction={LogOutAction} />
        <div className="mt-2 flex">{account}</div>
      </div>
    </nav>
  );
}
