"use client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useDeleteTrack } from "../hooks/use-delete-track";
import type { TrackDeletionProblem, TrackSummary } from "../types/track.types";

const PROBLEM_MESSAGES: Record<TrackDeletionProblem, string | undefined> = {
  "signed-out": undefined,
  invalid: "The Programme Track identifier is invalid.",
  forbidden: "You no longer have permission to delete Programme Tracks.",
  missing: "This Programme Track no longer exists. Refresh the catalogue.",
  attached:
    "This Programme Track is still attached to a Cohort and cannot be deleted.",
  unavailable:
    "We couldn't delete this Programme Track. Check your connection and try again.",
};

export function DeleteTrackDialog({
  track,
  open,
  onOpenChange,
}: {
  track: TrackSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deletion = useDeleteTrack({
    track,
    onDeleted: () => onOpenChange(false),
  });

  function changeOpen(next: boolean) {
    if (!next && deletion.isPending) return;
    if (!next) deletion.reset();
    onOpenChange(next);
  }

  const problemMessage = deletion.problem
    ? PROBLEM_MESSAGES[deletion.problem]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete {track.name}?</DialogTitle>
          <DialogDescription>
            This deletion is permanent and never cascades to Cohorts.
          </DialogDescription>
        </DialogHeader>
        {problemMessage ? (
          <p role="alert" className="text-destructive text-sm">
            {problemMessage}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose
            disabled={deletion.isPending}
            render={<Button variant="outline" />}
          >
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deletion.isPending}
            onClick={deletion.remove}
          >
            {deletion.isPending ? "Deleting…" : "Delete programme track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
