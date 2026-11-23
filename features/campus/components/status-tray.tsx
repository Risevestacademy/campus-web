"use client";

import { cn } from "cn";
import { useId } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import type { ChosenStatus } from "../services/status-choice/choose-status";
import {
  STATUS_DURATIONS,
  type StatusDurationId,
} from "../services/status-choice/status-durations";
import { STATUS_BADGE_CLASS_NAMES, STATUS_LABELS } from "./status-appearance";

const STATUSES = ["available", "busy", "away"] as const;

export type StatusTrayProps = Readonly<{
  canChoose: boolean;
  // Null for a status without a time, and for a timer set before a reload.
  durationId: StatusDurationId | null;
  id?: string;
  onDurationChange: (durationId: StatusDurationId | null) => void;
  onStatusChange: (status: ChosenStatus) => void;
  // For a dock too narrow for three statuses side by side: they stack, and
  // the tray takes the dock's width instead of widening it.
  stacked?: boolean;
  status: ChosenStatus;
  timeLeft: string | null;
  // The rail's account menu shows the status in its own header, so its tray
  // asks instead of summing up, and drops the dock's padding.
  variant?: "dock" | "menu";
}>;

function chosen<Value extends string>(
  values: readonly string[],
  allowed: readonly Value[],
): Value | undefined {
  return allowed.find((value) => value === values[0]);
}

export function StatusTray({
  canChoose,
  durationId,
  id,
  onDurationChange,
  onStatusChange,
  stacked = false,
  status,
  timeLeft,
  variant = "dock",
}: StatusTrayProps) {
  const headingId = useId();
  const durationLabelId = useId();
  const inMenu = variant === "menu";

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "text-foreground flex flex-col gap-2.5",
        !inMenu && "px-3.5 pt-3.5 pb-3",
        stacked && "contain-inline-size",
      )}
    >
      {inMenu ? (
        <h2
          id={headingId}
          className="text-foreground-secondary text-xs font-semibold"
        >
          Set your availability
        </h2>
      ) : (
        <div
          className={cn(
            "flex items-baseline justify-between gap-6",
            stacked && "flex-wrap gap-y-0.5",
          )}
        >
          <h2 id={headingId} className="text-sm font-semibold">
            Your status
          </h2>
          <p className="text-foreground-secondary text-xs">
            {STATUS_LABELS[status]}
            {timeLeft ? ` · ${timeLeft} left` : null}
          </p>
        </div>
      )}

      {canChoose ? null : (
        <p className="bg-warning-subtle border-warning-border text-warning-foreground rounded-lg border px-2.5 py-2 text-xs">
          You can change your status once you&apos;re back on the campus.
        </p>
      )}

      <ToggleGroup
        aria-label="Status"
        value={[status]}
        onValueChange={(values) =>
          onStatusChange(chosen(values, STATUSES) ?? status)
        }
        disabled={!canChoose}
        className={cn("w-full", stacked && "flex-col")}
      >
        {STATUSES.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            variant="outline"
            className={cn(
              "aria-pressed:border-primary aria-pressed:bg-surface-hover dark:aria-pressed:bg-cobalt-900 bg-background gap-2 aria-pressed:border-2",
              inMenu
                ? "h-10 flex-1 rounded-full px-2.5"
                : stacked
                  ? "h-10 w-full justify-start rounded-xl px-3"
                  : "h-12 flex-1 rounded-xl px-4",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                STATUS_BADGE_CLASS_NAMES[option],
              )}
            />
            {STATUS_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {status === "available" ? (
        inMenu ? (
          <p className="bg-surface-elevated text-foreground-secondary rounded-xl px-3 py-2.5 text-xs">
            Pick Busy or Away to choose how long it lasts.
          </p>
        ) : null
      ) : (
        <div
          className={cn(
            "flex flex-col gap-1.5",
            inMenu && "bg-surface-elevated rounded-xl p-3",
          )}
        >
          <span
            id={durationLabelId}
            className="text-foreground-secondary text-xs font-medium"
          >
            {inMenu ? `${STATUS_LABELS[status]} for` : "For"}
          </span>
          <ToggleGroup
            aria-labelledby={durationLabelId}
            value={durationId ? [durationId] : []}
            onValueChange={(values) =>
              onDurationChange(
                chosen(
                  values,
                  STATUS_DURATIONS.map((duration) => duration.id),
                ) ?? null,
              )
            }
            disabled={!canChoose}
            spacing={1.5}
            className={cn(
              "grid w-full",
              stacked ? "grid-cols-2" : "grid-cols-4",
            )}
          >
            {STATUS_DURATIONS.map((duration) => (
              <ToggleGroupItem
                key={duration.id}
                value={duration.id}
                variant="outline"
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground bg-background h-9 w-full rounded-[0.625rem] px-2 text-[0.8125rem] aria-pressed:border-transparent"
              >
                {duration.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </section>
  );
}
