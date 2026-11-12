"use client";

import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";
import { LockSimpleOpenIcon } from "@phosphor-icons/react/dist/ssr/LockSimpleOpen";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/ssr/SidebarSimple";
import { cn } from "cn";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/shared/ui/button";

import { useSidebarOpen } from "../hooks/use-sidebar-state";
import type { SpaceLock } from "../hooks/use-space-lock";
import { splitAtCap } from "../services/meeting/meeting";
import type { Meeting, MeetingParticipant } from "../types/active-campus.types";
import { useCampusView } from "./campus-view-provider";
import {
  meetingFadeVariants,
  meetingGroupVariants,
  meetingPresenceProps,
  meetingScaleVariants,
} from "./meeting-motion";

const STACK_CAP = 3;
const AVATAR_CLASS_NAME =
  "border-border grid size-6.5 place-items-center rounded-full border text-xs font-medium";

function StackAvatar({
  className,
  index,
  initials,
  label,
  reduceMotion,
}: Readonly<{
  className: string;
  index: number;
  initials: string;
  label: string;
  reduceMotion: boolean;
}>) {
  return (
    <motion.span
      layout={!reduceMotion}
      custom={reduceMotion}
      variants={meetingFadeVariants}
      {...meetingPresenceProps}
      role="img"
      aria-label={label}
      className={cn(index > 0 && "-ml-2")}
    >
      <motion.span
        custom={reduceMotion}
        variants={meetingScaleVariants}
        className={cn(AVATAR_CLASS_NAME, className)}
      >
        {initials}
      </motion.span>
    </motion.span>
  );
}

function MeetingParticipantStack({
  participants,
}: Readonly<{ participants: readonly MeetingParticipant[] }>) {
  const reduceMotion = Boolean(useReducedMotion());
  const { shown, remaining } = splitAtCap(participants, STACK_CAP);

  return (
    <div className="flex">
      <AnimatePresence initial={false} custom={reduceMotion}>
        {shown.map((participant, index) => (
          <StackAvatar
            key={participant.id}
            className={participant.avatarClassName}
            index={index}
            initials={participant.initial}
            label={participant.name}
            reduceMotion={reduceMotion}
          />
        ))}

        {remaining > 0 ? (
          <StackAvatar
            key="more-participants"
            className="bg-neutral-200 dark:bg-neutral-800"
            index={shown.length}
            initials={`+${remaining}`}
            label={`${remaining} more ${remaining === 1 ? "participant" : "participants"}`}
            reduceMotion={reduceMotion}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SpaceLockButton({ lock }: Readonly<{ lock: SpaceLock }>) {
  // A toggle: the name stays put and aria-pressed says whether it is locked.
  const label = `Lock ${lock.spaceName}`;

  return (
    <Button
      type="button"
      // Locked, it turns red, so it is the elevated surface only while open.
      data-surface-role={lock.locked ? undefined : "surface-elevated"}
      size="icon-xs"
      variant="ghost"
      aria-label={label}
      aria-pressed={lock.locked}
      title={label}
      disabled={!lock.canChange}
      onClick={lock.toggle}
      className="bg-surface-elevated border-border aria-pressed:bg-error-subtle aria-pressed:border-error-border aria-pressed:text-error-icon size-10 rounded-xl border [&_svg:not([class*='size-'])]:size-5"
    >
      {lock.locked ? (
        <LockSimpleIcon aria-hidden weight="bold" />
      ) : (
        <LockSimpleOpenIcon aria-hidden />
      )}
    </Button>
  );
}

export function MeetingHeader({
  lock = null,
  meeting,
}: Readonly<{ lock?: SpaceLock | null; meeting: Meeting | null }>) {
  const { openSidebar } = useCampusView();
  const sidebarOpen = useSidebarOpen();
  const reduceMotion = Boolean(useReducedMotion());
  const title = meeting?.title ?? lock?.spaceName;

  return (
    <header className="flex h-fit items-center gap-3">
      {sidebarOpen ? null : (
        <Button
          type="button"
          data-surface-role="surface-elevated"
          size="icon"
          variant="ghost"
          aria-label="Open sidebar"
          title="Open sidebar"
          onClick={openSidebar}
          className="bg-surface-elevated border-border size-10 rounded-xl border [&_svg:not([class*='size-'])]:size-5"
        >
          <SidebarSimpleIcon aria-hidden />
        </Button>
      )}

      <AnimatePresence initial={false} custom={reduceMotion}>
        {meeting || lock ? (
          <motion.div
            key="meeting"
            custom={reduceMotion}
            variants={meetingGroupVariants}
            {...meetingPresenceProps}
            className="flex items-center gap-1.5"
          >
            {meeting ? (
              <MeetingParticipantStack participants={meeting.participants} />
            ) : null}
            {lock ? <SpaceLockButton lock={lock} /> : null}
            <h2 className="text-sm font-medium">{title}</h2>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
