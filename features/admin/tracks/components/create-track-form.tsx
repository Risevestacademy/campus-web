"use client";
import { type FormEvent, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";

import type { TrackCreationControls } from "../hooks/use-create-track";
import { parseNewTrack } from "../schemas/track.schema";
import type {
  TrackCreationProblem,
  TrackFieldErrors,
} from "../types/track.types";
import { TrackFormFields } from "./track-form-fields";

const PROBLEM_MESSAGES: Record<TrackCreationProblem, string | undefined> = {
  "duplicate-code": undefined,
  "signed-out": undefined,
  rejected:
    "campus-api rejected these details. Review the fields and try again.",
  forbidden: "You no longer have permission to create Programme Tracks.",
  unavailable:
    "We couldn't create this Programme Track. Check your connection and try again.",
};

export function CreateTrackForm({
  creation,
}: {
  creation: TrackCreationControls;
}) {
  const [errors, setErrors] = useState<TrackFieldErrors>({});
  const codeError =
    errors.code ??
    (creation.problem === "duplicate-code"
      ? "Another Programme Track already uses this code."
      : undefined);
  const problemMessage = creation.problem
    ? PROBLEM_MESSAGES[creation.problem]
    : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseNewTrack(new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    if (read.kind === "valid") creation.create(read.track);
  }
  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      {problemMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {problemMessage}
        </p>
      ) : null}
      <TrackFormFields errors={{ ...errors, code: codeError }} />
      <DialogFooter>
        <DialogClose
          disabled={creation.isPending}
          render={<Button variant="outline" />}
        >
          Cancel
        </DialogClose>
        <Button type="submit" disabled={creation.isPending}>
          {creation.isPending ? "Creating…" : "Create programme track"}
        </Button>
      </DialogFooter>
    </form>
  );
}
