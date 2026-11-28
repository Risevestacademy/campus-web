"use client";

import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { PersonActionsAvailable } from "../person-actions";
import {
  ReinstateDialog,
  SuspendDialog,
  SystemRoleDialog,
} from "./person-action-dialogs";

type Action = "role" | "suspend" | "reinstate";

export function PersonActions({
  userId,
  name,
  actions,
}: {
  userId: string;
  name: string;
  actions: PersonActionsAvailable;
}) {
  const [action, setAction] = useState<Action>();
  const openChange = (which: Action) => (open: boolean) =>
    setAction(open ? which : undefined);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Manage ${name}`}
            />
          }
        >
          <DotsThreeVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        {/* As wide as its longest item, not the small trigger, so no label wraps. */}
        <DropdownMenuContent
          align="end"
          aria-label={`${name} actions`}
          className="w-max whitespace-nowrap"
        >
          {actions.roleChange ? (
            <DropdownMenuItem onClick={() => setAction("role")}>
              {actions.roleChange === "admin"
                ? "Promote to admin"
                : "Demote from admin"}
            </DropdownMenuItem>
          ) : null}
          {actions.suspend ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setAction("suspend")}
            >
              Suspend
            </DropdownMenuItem>
          ) : null}
          {actions.reinstate ? (
            <DropdownMenuItem onClick={() => setAction("reinstate")}>
              Reinstate
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.roleChange ? (
        <SystemRoleDialog
          userId={userId}
          name={name}
          systemRole={actions.roleChange}
          open={action === "role"}
          onOpenChange={openChange("role")}
        />
      ) : null}
      {actions.suspend ? (
        <SuspendDialog
          userId={userId}
          name={name}
          open={action === "suspend"}
          onOpenChange={openChange("suspend")}
        />
      ) : null}
      {actions.reinstate ? (
        <ReinstateDialog
          userId={userId}
          name={name}
          open={action === "reinstate"}
          onOpenChange={openChange("reinstate")}
        />
      ) : null}
    </>
  );
}
