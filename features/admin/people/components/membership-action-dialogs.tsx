"use client";

import { type FormEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/native-select";
import { Textarea } from "@/shared/ui/textarea";

import {
  useEndMembership,
  useExtendGuestVisit,
  useMoveMemberTrack,
} from "../hooks/use-membership-actions";
import {
  END_REASON_MAX_LENGTH,
  parseEndMembershipForm,
  parseExtendVisitForm,
  parseMoveTrackForm,
} from "../schemas/membership-forms.schema";
import type {
  MembershipEnd,
  MembershipEndProblem,
  MembershipMoveProblem,
  TrackOption,
  VisitExtendProblem,
} from "../types/people.types";
import { ConfirmDialog } from "./person-action-dialogs";

type Messages<TProblem extends string> = Readonly<
  Record<TProblem, string | undefined>
>;

const FORBIDDEN = "You no longer have permission to change memberships.";
const UNAVAILABLE =
  "We couldn't make this change. Nothing was changed. Check your connection and try again.";

const END_PROBLEMS: Messages<MembershipEndProblem> = {
  invalid: "campus-api rejected this request. Check the reason and try again.",
  "signed-out": undefined,
  forbidden: FORBIDDEN,
  missing: "They're no longer in this cohort. Refresh the page.",
  "not-endable":
    "This membership has already ended, or can't end this way. Refresh the page.",
  unavailable: UNAVAILABLE,
};

const MOVE_PROBLEMS: Messages<MembershipMoveProblem> = {
  invalid: "campus-api rejected this request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: FORBIDDEN,
  missing:
    "They're no longer in this cohort, or that track no longer exists. Refresh the page.",
  "not-movable":
    "They can't move to that track. They may already be on it or have left the cohort, or the cohort may no longer run it. Refresh the page.",
  unavailable: UNAVAILABLE,
};

const EXTEND_PROBLEMS: Messages<VisitExtendProblem> = {
  invalid:
    "campus-api needs an end later than now and later than the current one.",
  "signed-out": undefined,
  forbidden: FORBIDDEN,
  missing: "They're no longer in this cohort. Refresh the page.",
  "visit-ended":
    "This visit has already ended. Send them a new invite instead.",
  unavailable: UNAVAILABLE,
};

interface EndCopy {
  title: (name: string) => string;
  description: string;
  confirm: string;
  pending: string;
  destructive: boolean;
  reasonRequired: boolean;
}

const LEAVES =
  "Their place in this cohort ends and they lose access to it. They move to Former members, and this can't be undone here.";

export const END_COPY: Readonly<Record<MembershipEnd, EndCopy>> = {
  graduate: {
    title: (name) => `Mark ${name} as graduated?`,
    description: LEAVES,
    confirm: "Mark as graduated",
    pending: "Saving…",
    destructive: false,
    reasonRequired: false,
  },
  defer: {
    title: (name) => `Defer ${name}?`,
    description: `${LEAVES} To return, they need a new invite.`,
    confirm: "Defer",
    pending: "Deferring…",
    destructive: false,
    reasonRequired: false,
  },
  withdraw: {
    title: (name) => `Withdraw ${name}?`,
    description: LEAVES,
    confirm: "Withdraw",
    pending: "Withdrawing…",
    destructive: true,
    reasonRequired: false,
  },
  dismiss: {
    title: (name) => `Dismiss ${name}?`,
    description: LEAVES,
    confirm: "Dismiss",
    pending: "Dismissing…",
    destructive: true,
    reasonRequired: true,
  },
  remove: {
    title: (name) => `Remove ${name} from this cohort?`,
    description:
      "Their place in this cohort ends and they lose access to it. Their account stays, along with any other cohorts they're in.",
    confirm: "Remove",
    pending: "Removing…",
    destructive: true,
    reasonRequired: false,
  },
};

interface MembershipDialogProps {
  cohortId: string;
  userId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EndMembershipDialog({
  end,
  cohortId,
  userId,
  name,
  open,
  onOpenChange,
}: MembershipDialogProps & { end: MembershipEnd }) {
  const copy = END_COPY[end];
  const reasonId = useId();
  const [reasonError, setReasonError] = useState<string>();
  const ending = useEndMembership({
    cohortId,
    userId,
    name,
    end,
    onDone: () => onOpenChange(false),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseEndMembershipForm(new FormData(event.currentTarget), {
      reasonRequired: copy.reasonRequired,
    });
    if (read.kind === "invalid") {
      setReasonError(read.error);
      return;
    }
    setReasonError(undefined);
    ending.end(read.request);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReasonError(undefined);
        onOpenChange(next);
      }}
      isPending={ending.isPending}
      reset={ending.reset}
      title={copy.title(name)}
      description={copy.description}
      problem={ending.problem && END_PROBLEMS[ending.problem]}
      onSubmit={submit}
      confirm={
        <Button
          type="submit"
          variant={copy.destructive ? "destructive" : "default"}
          disabled={ending.isPending}
        >
          {ending.isPending ? copy.pending : copy.confirm}
        </Button>
      }
    >
      <Field data-invalid={reasonError ? true : undefined}>
        <FieldLabel htmlFor={reasonId}>
          {copy.reasonRequired ? "Reason" : "Reason (optional)"}
        </FieldLabel>
        <Textarea
          id={reasonId}
          name="reason"
          maxLength={END_REASON_MAX_LENGTH}
          required={copy.reasonRequired}
          disabled={ending.isPending}
          aria-invalid={reasonError ? true : undefined}
        />
        {reasonError ? (
          <FieldError>{reasonError}</FieldError>
        ) : (
          <FieldDescription>
            {end === "dismiss"
              ? "Shown with them under Former members and kept in the audit log."
              : "Kept in the audit log."}
          </FieldDescription>
        )}
      </Field>
    </ConfirmDialog>
  );
}

export function MoveTrackDialog({
  tracks,
  cohortId,
  userId,
  name,
  open,
  onOpenChange,
}: MembershipDialogProps & { tracks: readonly TrackOption[] }) {
  const trackId = useId();
  const [trackError, setTrackError] = useState<string>();
  const move = useMoveMemberTrack({
    cohortId,
    userId,
    name,
    onDone: () => onOpenChange(false),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseMoveTrackForm(
      new FormData(event.currentTarget),
      tracks.map(({ id }) => id),
    );
    if (read.kind === "invalid") {
      setTrackError(read.error);
      return;
    }
    setTrackError(undefined);
    move.move(read.request);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTrackError(undefined);
        onOpenChange(next);
      }}
      isPending={move.isPending}
      reset={move.reset}
      title={`Change ${name}'s track?`}
      description="They stay in this cohort and keep everything else about their place. Only the track changes."
      problem={move.problem && MOVE_PROBLEMS[move.problem]}
      onSubmit={submit}
      confirm={
        <Button type="submit" disabled={move.isPending}>
          {move.isPending ? "Saving…" : "Change track"}
        </Button>
      }
    >
      <Field data-invalid={trackError ? true : undefined}>
        <FieldLabel htmlFor={trackId}>New track</FieldLabel>
        <NativeSelect
          id={trackId}
          name="trackId"
          defaultValue=""
          disabled={move.isPending}
          aria-invalid={trackError ? true : undefined}
        >
          <option value="" disabled>
            Choose a track
          </option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </NativeSelect>
        {trackError ? <FieldError>{trackError}</FieldError> : null}
      </Field>
    </ConfirmDialog>
  );
}

// The dialog renders only once it opens, in the browser, so the browser's
// own zone is the one shown and the one the field is read in.
function formatEnd(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ExtendVisitDialog({
  currentEnd,
  cohortId,
  userId,
  name,
  open,
  onOpenChange,
}: MembershipDialogProps & { currentEnd: string }) {
  const endId = useId();
  const [endError, setEndError] = useState<string>();
  const extension = useExtendGuestVisit({
    cohortId,
    userId,
    name,
    onDone: () => onOpenChange(false),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseExtendVisitForm(new FormData(event.currentTarget), {
      currentEnd,
      now: Date.now(),
    });
    if (read.kind === "invalid") {
      setEndError(read.error);
      return;
    }
    setEndError(undefined);
    extension.extend(read.request);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setEndError(undefined);
        onOpenChange(next);
      }}
      isPending={extension.isPending}
      reset={extension.reset}
      title={`Extend ${name}'s visit?`}
      description={
        <>
          Their visit ends{" "}
          <time dateTime={currentEnd}>{formatEnd(currentEnd)}</time>. They
          don&apos;t need to sign in again.
        </>
      }
      problem={extension.problem && EXTEND_PROBLEMS[extension.problem]}
      onSubmit={submit}
      confirm={
        <Button type="submit" disabled={extension.isPending}>
          {extension.isPending ? "Saving…" : "Extend visit"}
        </Button>
      }
    >
      <Field data-invalid={endError ? true : undefined}>
        <FieldLabel htmlFor={endId}>New end</FieldLabel>
        <Input
          id={endId}
          type="datetime-local"
          name="accessExpiresAt"
          required
          disabled={extension.isPending}
          aria-invalid={endError ? true : undefined}
        />
        {endError ? (
          <FieldError>{endError}</FieldError>
        ) : (
          <FieldDescription>In your own time zone.</FieldDescription>
        )}
      </Field>
    </ConfirmDialog>
  );
}
