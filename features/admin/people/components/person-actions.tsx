"use client";

import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import {
  hasMembershipActions,
  type MembershipActionsAvailable,
  NO_MEMBERSHIP_ACTIONS,
} from "../membership-actions";
import {
  hasPersonActions,
  type PersonActionsAvailable,
} from "../person-actions";
import type { MembershipEnd } from "../types/people.types";
import {
  END_COPY,
  EndMembershipDialog,
  ExtendVisitDialog,
  MoveTrackDialog,
} from "./membership-action-dialogs";
import {
  ReinstateDialog,
  SuspendDialog,
  SystemRoleDialog,
} from "./person-action-dialogs";

type Action =
  | "role"
  | "suspend"
  | "reinstate"
  | "track"
  | "extend"
  | `end:${MembershipEnd}`;

const END_ITEMS: Readonly<Record<MembershipEnd, string>> = {
  graduate: "Mark as graduated",
  defer: "Defer",
  withdraw: "Withdraw",
  dismiss: "Dismiss",
  remove: "Remove from cohort",
};

export function PersonActions({
  cohortId,
  userId,
  name,
  actions,
  membership = NO_MEMBERSHIP_ACTIONS,
}: {
  cohortId: string;
  userId: string;
  name: string;
  actions: PersonActionsAvailable;
  membership?: MembershipActionsAvailable;
}) {
  const [action, setAction] = useState<Action>();
  const openChange = (which: Action) => (open: boolean) =>
    setAction(open ? which : undefined);
  const { moveTo, visitEnds, ends } = membership;
  const target = { cohortId, userId, name };

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
          {moveTo.length > 0 ? (
            <DropdownMenuItem onClick={() => setAction("track")}>
              Change track
            </DropdownMenuItem>
          ) : null}
          {visitEnds ? (
            <DropdownMenuItem onClick={() => setAction("extend")}>
              Extend visit
            </DropdownMenuItem>
          ) : null}
          {ends.map((end) => (
            <DropdownMenuItem
              key={end}
              variant={END_COPY[end].destructive ? "destructive" : "default"}
              onClick={() => setAction(`end:${end}`)}
            >
              {END_ITEMS[end]}
            </DropdownMenuItem>
          ))}
          {hasMembershipActions(membership) && hasPersonActions(actions) ? (
            <DropdownMenuSeparator />
          ) : null}
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
      {moveTo.length > 0 ? (
        <MoveTrackDialog
          {...target}
          tracks={moveTo}
          open={action === "track"}
          onOpenChange={openChange("track")}
        />
      ) : null}
      {visitEnds ? (
        <ExtendVisitDialog
          {...target}
          currentEnd={visitEnds}
          open={action === "extend"}
          onOpenChange={openChange("extend")}
        />
      ) : null}
      {ends.map((end) => (
        <EndMembershipDialog
          key={end}
          {...target}
          end={end}
          open={action === `end:${end}`}
          onOpenChange={openChange(`end:${end}`)}
        />
      ))}
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
