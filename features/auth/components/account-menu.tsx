"use client";

import type { ReactNode } from "react";

import { openAnalyticsConsentChoices } from "@/core/analytics/consent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { useLogOut } from "../hooks/use-log-out";

export function AccountMenu({
  children,
  side = "right",
}: {
  children: ReactNode;
  side?: "bottom" | "right";
}) {
  const { logOut, isPending } = useLogOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end">
        <DropdownMenuItem onClick={openAnalyticsConsentChoices}>
          Privacy choices
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onClick={logOut}
        >
          {isPending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
