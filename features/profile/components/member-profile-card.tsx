"use client";

import { DeskIcon } from "@phosphor-icons/react/dist/ssr/Desk";
import { cn } from "cn";
import type { ReactNode } from "react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { PopoverTitle } from "@/shared/ui/popover";

import { useMemberProfile } from "../hooks/use-member-profile";
import { cardNameOf, roleLineOf } from "../schemas/member-profile.schema";
import type { MemberProfileRead } from "../types";

// Stand-in until desks are read: the card shows where a desk will go.
const PLACEHOLDER_DESK = {
  label: "Desk D-04",
  detail: "Claimed in Cohort 2026",
};

export type MemberProfileCardProps = Readonly<{
  userId: string;
  cohortId: string;
  // What the caller already shows for them, drawn until the card is read.
  name: string;
  initial: string;
  avatarClassName: string;
  // The caller owns presence: its badge color and a line such as "Busy · 4 min".
  presence: { badgeClassName: string; label: string };
  actions?: ReactNode;
}>;

// Another member's profile card. Draw it inside a Popover: its name is the
// popover's title.
export function MemberProfileCard({
  actions,
  avatarClassName,
  cohortId,
  initial,
  name,
  presence,
  userId,
}: MemberProfileCardProps) {
  const read = useMemberProfile(userId);
  const profile = read?.kind === "loaded" ? read.profile : undefined;
  const roleLine = profile ? roleLineOf(profile, cohortId) : null;
  const bio = profile?.bio?.trim();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 dark:after:border-transparent">
          {profile?.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback
            className={cn("text-lg font-medium", avatarClassName)}
          >
            {initial}
          </AvatarFallback>
          <AvatarBadge className={cn("size-3", presence.badgeClassName)} />
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <PopoverTitle className="truncate text-sm font-medium">
            {profile ? cardNameOf(profile, name) : name}
          </PopoverTitle>
          {roleLine ? (
            <p className="text-foreground-secondary truncate text-xs">
              {roleLine}
            </p>
          ) : null}
          <p className="text-foreground-secondary truncate text-xs">
            {presence.label}
          </p>
        </div>
      </div>

      <CardBody bio={bio} read={read} />

      {actions}

      <div className="bg-muted flex items-center gap-2.5 rounded-lg px-3 py-2">
        <DeskIcon aria-hidden size={16} className="text-primary shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium">{PLACEHOLDER_DESK.label}</span>
          <span className="text-foreground-secondary text-xs">
            {PLACEHOLDER_DESK.detail}
          </span>
        </div>
        <Button type="button" variant="link" size="xs" className="shrink-0">
          View desk
        </Button>
      </div>
    </div>
  );
}

function CardBody({
  bio,
  read,
}: {
  bio: string | undefined;
  read: MemberProfileRead | undefined;
}) {
  if (!read) {
    return (
      <p className="text-foreground-secondary text-sm" aria-live="polite">
        Loading profile…
      </p>
    );
  }
  if (read.kind === "missing") {
    return (
      <p className="text-foreground-secondary text-sm">
        This profile isn&apos;t available.
      </p>
    );
  }
  if (read.kind !== "loaded") {
    return (
      <p role="alert" className="text-destructive text-sm">
        We couldn&apos;t load this profile. Close it and try again.
      </p>
    );
  }
  return bio ? (
    <p className="text-foreground-secondary text-sm">“{bio}”</p>
  ) : null;
}
