"use client";
import { type FormEvent, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";

import { parseNewTrack } from "../schemas/track.schema";
import type { TrackFieldErrors } from "../types/track.types";
import type { ReturnTypeOfUseCreateTrack } from "../types/track-ui.types";
import { TrackFormFields } from "./track-form-fields";
export function CreateTrackForm({
  creation,
}: {
  creation: ReturnTypeOfUseCreateTrack;
}) {
  const [errors, setErrors] = useState<TrackFieldErrors>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseNewTrack(new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    if (read.kind === "valid") creation.create(read.track);
  }
  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <TrackFormFields errors={errors} />
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
