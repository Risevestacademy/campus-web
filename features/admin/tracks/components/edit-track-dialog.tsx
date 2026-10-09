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
import type {
  TrackEditProblem,
  TrackFieldErrors,
  TrackSummary,
} from "../types/track.types";
import { TrackFormFields } from "./track-form-fields";

const PROBLEM_MESSAGES: Record<TrackEditProblem, string | undefined> = {
  "duplicate-code": undefined,
  "signed-out": undefined,
  invalid:
    "campus-api rejected these changes. Review the fields and try again.",
  forbidden: "You no longer have permission to edit Programme Tracks.",
  missing: "This Programme Track no longer exists. Refresh the catalogue.",
  unavailable:
    "We couldn't update this Programme Track. Check your connection and try again.",
};

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

  function changeOpen(next: boolean) {
    if (!next && editing.isPending) return;
    if (!next) {
      editing.reset();
      setErrors({});
      setUnchanged(false);
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseTrackEdit(track, new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    setUnchanged(read.kind === "unchanged");
    if (read.kind === "valid") {
      editing.edit(read.changes);
    } else {
      editing.reset();
    }
  }

  const codeError =
    errors.code ??
    (editing.problem === "duplicate-code"
      ? "Another Programme Track already uses this code."
      : undefined);
  const problemMessage = editing.problem
    ? PROBLEM_MESSAGES[editing.problem]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit {track.name}</DialogTitle>
          <DialogDescription>
            Only changed fields will be saved.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-6">
          {problemMessage ? (
            <p role="alert" className="text-destructive text-sm">
              {problemMessage}
            </p>
          ) : null}
          {unchanged ? (
            <p role="alert">Change at least one field before saving.</p>
          ) : null}
          <TrackFormFields
            values={{ ...track, description: track.description ?? undefined }}
            errors={{ ...errors, code: codeError }}
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
