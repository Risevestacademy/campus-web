"use client";

import { SidebarIcon } from "@phosphor-icons/react/dist/ssr/Sidebar";
import { cn } from "cn";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  getServerSidebarOpenSnapshot,
  getSidebarOpenSnapshot,
  setSidebarOpen,
  subscribeToShell,
} from "./shell-store";

/**
 * Reopens the sidebar from the map layer once it has been collapsed. Hidden
 * whenever the sidebar is already open, since `CampusSidebar` then owns the
 * collapse control itself.
 */
export function SidebarReopenToggle() {
  const isOpen = useSyncExternalStore(
    subscribeToShell,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );

  if (isOpen) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Open sidebar"
        onClick={() => setSidebarOpen(true)}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "bg-surface-elevated",
        )}
      >
        <SidebarIcon aria-hidden size={18} weight="regular" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Open sidebar</TooltipContent>
    </Tooltip>
  );
}
