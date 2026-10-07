"use client";

import { SidebarIcon } from "@phosphor-icons/react/dist/ssr/Sidebar";
import { cn } from "cn";

import { buttonVariants } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { setSidebarOpen } from "../../store/sidebar-store";

export function SidebarCollapseButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Collapse sidebar"
        onClick={() => setSidebarOpen(false)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-icon-muted hover:text-icon shrink-0",
        )}
      >
        <SidebarIcon aria-hidden size={18} weight="regular" />
      </TooltipTrigger>
      <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
    </Tooltip>
  );
}
