"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";

import type { TrackSummary } from "../../tracks/types/track.types";
import {
  useAttachCohortTrack,
  useDetachCohortTrack,
} from "../hooks/use-cohort-track-mutations";
import type { CohortTrackMutationProblem } from "../types/cohort-track.types";

const ATTACHMENT_PROBLEMS: Partial<Record<CohortTrackMutationProblem, string>> =
  {
    invalid: "The Cohort or Programme Track identifier is invalid.",
    forbidden: "You no longer have permission to attach Programme Tracks.",
    missing: "The Cohort or Programme Track no longer exists.",
    "already-attached": "This Programme Track is already attached.",
    unavailable: "We couldn't attach this Programme Track. Try again.",
  };

const DETACHMENT_PROBLEMS: Partial<Record<CohortTrackMutationProblem, string>> =
  {
    invalid: "The Cohort or Programme Track identifier is invalid.",
    forbidden: "You no longer have permission to detach Programme Tracks.",
    missing: "This Cohort Track association no longer exists.",
    "in-use":
      "Students or Invitations still reference this Programme Track. Move or remove those references before detaching it.",
    unavailable: "We couldn't detach this Programme Track. Try again.",
  };

export function AttachCohortTrackForm({
  cohortId,
  tracks,
}: {
  cohortId: string;
  tracks: readonly TrackSummary[];
}) {
  const attachment = useAttachCohortTrack(cohortId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trackId = new FormData(event.currentTarget).get("trackId");
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (track) attachment.attach(track);
  }

  const problem = attachment.problem
    ? ATTACHMENT_PROBLEMS[attachment.problem]
    : undefined;

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3">
      <Label htmlFor="cohort-track">Programme Track</Label>
      <select
        id="cohort-track"
        name="trackId"
        defaultValue=""
        required
        disabled={attachment.isPending}
        onChange={() => attachment.reset()}
        className="border-input bg-background h-10 rounded-lg border px-3"
      >
        <option value="" disabled>
          Choose a Programme Track
        </option>
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name} ({track.code})
          </option>
        ))}
      </select>
      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}
      <Button type="submit" disabled={attachment.isPending} className="w-fit">
        {attachment.isPending ? "Attaching…" : "Attach track"}
      </Button>
    </form>
  );
}

export function DetachCohortTrackDialog({
  cohortId,
  track,
}: {
  cohortId: string;
  track: TrackSummary;
}) {
  const [open, setOpen] = useState(false);
  const detachment = useDetachCohortTrack({
    cohortId,
    track,
    onDetached: () => setOpen(false),
  });

  function changeOpen(next: boolean) {
    if (!next && detachment.isPending) return;
    if (!next) detachment.reset();
    setOpen(next);
  }

  const problem = detachment.problem
    ? DETACHMENT_PROBLEMS[detachment.problem]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Detach ${track.name}`}
          />
        }
      >
        Detach
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Detach {track.name}?</DialogTitle>
          <DialogDescription>
            This removes the Track from this Cohort. The Programme Track stays
            in the catalogue.
          </DialogDescription>
        </DialogHeader>
        {problem ? (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose
            disabled={detachment.isPending}
            render={<Button variant="outline" />}
          >
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={detachment.isPending}
            onClick={detachment.detach}
          >
            {detachment.isPending ? "Detaching…" : "Detach track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
