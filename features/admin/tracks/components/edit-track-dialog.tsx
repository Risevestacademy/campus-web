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
} from "@/shared/ui/dialog";

import { useEditTrack } from "../hooks/use-edit-track";
import { parseTrackEdit } from "../schemas/track.schema";
import type { TrackFieldErrors, TrackSummary } from "../types/track.types";
import { TrackFormFields } from "./track-form-fields";
export function EditTrackDialog({
  track,
  open,
  onOpenChange,
}: {
  track: TrackSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [errors, setErrors] = useState<TrackFieldErrors>({});
  const [unchanged, setUnchanged] = useState(false);
  const editing = useEditTrack({ track, onEdited: () => onOpenChange(false) });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseTrackEdit(track, new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    setUnchanged(read.kind === "unchanged");
    if (read.kind === "valid") editing.edit(read.changes);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit {track.name}</DialogTitle>
          <DialogDescription>
            Only changed fields will be saved.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-6">
          {editing.problem === "attached" ? (
            <p role="alert">
              This Programme Track is still attached to a Cohort.
            </p>
          ) : null}
          {unchanged ? (
            <p role="alert">Change at least one field before saving.</p>
          ) : null}
          <TrackFormFields
            values={{ ...track, description: track.description ?? undefined }}
            errors={errors}
          />
          <DialogFooter>
            <DialogClose
              disabled={editing.isPending}
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={editing.isPending}>
              {editing.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
