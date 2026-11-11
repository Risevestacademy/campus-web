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
  // Null while a timer runs that this tray did not set, after a reload.
  durationId: StatusDurationId | null;
  id?: string;
  onDurationChange: (durationId: StatusDurationId) => void;
  onStatusChange: (status: ChosenStatus) => void;
  refusals: Partial<Record<StatusDurationId, string>>;
  status: ChosenStatus;
  timeLeft: string | null;
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
  refusals,
  status,
  timeLeft,
}: StatusTrayProps) {
  const headingId = useId();
  const durationLabelId = useId();
  const refusalNotes = [...new Set(Object.values(refusals))];

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="text-foreground @container flex flex-col gap-2.5 px-3.5 pt-3.5 pb-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
        <h2 id={headingId} className="text-sm font-semibold">
          Your status
        </h2>
        <p className="text-foreground-secondary text-xs">
          {STATUS_LABELS[status]}
          {timeLeft ? ` · ${timeLeft} left` : null}
        </p>
      </div>

      {canChoose ? null : (
        <p className="bg-warning-subtle border-warning-border text-warning-foreground rounded-lg border px-2.5 py-2 text-xs">
          You can change your status once you&apos;re back on the campus.
        </p>
      )}

      <ToggleGroup
        aria-label="Status"
        value={[status]}
        onValueChange={(values) => {
          const next = chosen(values, STATUSES);
          if (next) onStatusChange(next);
        }}
        disabled={!canChoose}
        className="w-full flex-col @xs:flex-row"
      >
        {STATUSES.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            variant="outline"
            className="aria-pressed:border-primary aria-pressed:bg-surface-hover dark:aria-pressed:bg-cobalt-900 bg-background h-10 w-full justify-start gap-2 rounded-xl px-3 aria-pressed:border-2 @xs:h-12 @xs:w-auto @xs:min-w-0 @xs:flex-1 @xs:shrink @xs:justify-center"
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                STATUS_BADGE_CLASS_NAMES[option],
              )}
            />
            {STATUS_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {status === "available" ? null : (
        <div className="flex flex-col gap-1.5">
          <span
            id={durationLabelId}
            className="text-foreground-secondary text-xs font-medium"
          >
            For
          </span>
          <ToggleGroup
            aria-labelledby={durationLabelId}
            value={durationId ? [durationId] : []}
            onValueChange={(values) => {
              const next = chosen(
                values,
                STATUS_DURATIONS.map((duration) => duration.id),
              );
              if (next) onDurationChange(next);
            }}
            disabled={!canChoose}
            spacing={1.5}
            className="grid w-full grid-cols-3 @xs:grid-cols-5"
          >
            {STATUS_DURATIONS.map((duration) => (
              <ToggleGroupItem
                key={duration.id}
                value={duration.id}
                variant="outline"
                disabled={refusals[duration.id] !== undefined}
                title={refusals[duration.id]}
                className={cn(
                  "aria-pressed:bg-primary aria-pressed:text-primary-foreground bg-background h-9 w-full rounded-[0.625rem] px-2 text-[0.8125rem] aria-pressed:border-transparent",
                  duration.id === "lasting" && "col-span-full",
                )}
              >
                {duration.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {refusalNotes.map((note) => (
            <p key={note} className="text-foreground-secondary text-xs">
              {note}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
