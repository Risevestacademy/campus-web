"use client";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { useCreateTrack } from "../hooks/use-create-track";
import { CreateTrackForm } from "./create-track-form";
export function CreateTrackTile() {
  const [open, setOpen] = useState(false);
  const creation = useCreateTrack({ onCreated: () => setOpen(false) });

  function changeOpen(next: boolean) {
    if (!next && creation.isPending) return;
    if (next) creation.reset();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group w-fit cursor-pointer text-left outline-none"
          />
        }
      >
        <span className="border-border text-foreground-secondary mb-2 grid aspect-video w-80 place-items-center rounded-2xl border-2 border-dashed">
          <PlusIcon aria-hidden="true" className="size-8" />
        </span>
        <span className="block pl-2 font-medium">Create Programme Track</span>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Create a Programme Track</DialogTitle>
          <DialogDescription>
            Add a reusable track before assigning it to cohorts.
          </DialogDescription>
        </DialogHeader>
        <CreateTrackForm creation={creation} />
      </DialogContent>
    </Dialog>
  );
}
