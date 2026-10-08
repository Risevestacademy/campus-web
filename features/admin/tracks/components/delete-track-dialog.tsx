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
import type { TrackSummary } from "../types/track.types";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete {track.name}?</DialogTitle>
          <DialogDescription>
            This deletion is permanent and never cascades to Cohorts.
          </DialogDescription>
        </DialogHeader>
        {deletion.problem === "attached" ? (
          <p role="alert">
            This Programme Track is still attached to a Cohort and cannot be
            deleted.
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
