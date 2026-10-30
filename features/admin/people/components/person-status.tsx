"use client";

import { cn } from "cn";
import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";

type StatusKey = "available" | "busy" | "away" | "offline";

const STATUS_DETAILS: Readonly<
  Record<StatusKey, { label: string; dotClassName: string }>
> = {
  available: { label: "Available", dotClassName: "bg-success" },
  busy: { label: "Busy", dotClassName: "bg-error" },
  away: { label: "Away", dotClassName: "bg-warning" },
  offline: { label: "Offline", dotClassName: "bg-icon-muted" },
};

export function PersonStatus({
  cohortId,
  userId,
  className,
}: {
  cohortId: string;
  userId: string;
  className?: string;
}) {
  const presence = presenceFor(cohortId);
  const status = useStore(
    presence,
    (state) => state.participants.get(userId)?.status,
  );
  // Until a current snapshot arrives nobody is known to be online. The map
  // outlives a closed socket, so it cannot say whether the snapshot is current.
  const hasSnapshot = useStore(presence, (state) => state.synced);

  if (!hasSnapshot) {
    return (
      <span className={cn("text-foreground-secondary", className)}>—</span>
    );
  }

  const key: StatusKey =
    status === undefined
      ? "offline"
      : status === "busy" || status === "away"
        ? status
        : "available";
  const { label, dotClassName } = STATUS_DETAILS[key];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", dotClassName)}
      />
      {label}
    </span>
  );
}
