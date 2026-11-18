"use client";

import { SidebarIcon } from "@phosphor-icons/react/dist/ssr/Sidebar";
import { cn } from "cn";

import { buttonVariants } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { useCampusView } from "../campus-view-provider";

export function SidebarCollapseButton() {
  const { closeSidebar } = useCampusView();

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Collapse sidebar"
        onClick={closeSidebar}
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
