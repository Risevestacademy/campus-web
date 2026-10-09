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

import { useCreateCohort } from "../hooks/use-create-cohort";
import { CreateCohortForm } from "./create-cohort-form";

export function CreateCohortTile({ page }: { page: number }) {
  const [open, setOpen] = useState(false);
  const creation = useCreateCohort({ page, onCreated: () => setOpen(false) });

  // Closing mid-request would leave the admin unsure whether the cohort
  // exists. The popup unmounts on close, which resets the form.
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
        <span className="border-border text-foreground-secondary group-hover:border-foreground-secondary group-hover:text-foreground group-focus-visible:ring-ring/50 mb-2 grid aspect-video w-80 place-items-center rounded-2xl border-2 border-dashed transition-[border-color,color,box-shadow,scale] duration-150 ease-out group-focus-visible:ring-3 group-active:scale-96 motion-reduce:group-active:scale-100">
          <PlusIcon
            aria-hidden="true"
            className="size-8 transition-[scale] duration-150 ease-out group-hover:scale-105"
          />
        </span>
        <span className="line-clamp-1 block pl-2 font-medium">
          Create cohort
        </span>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a cohort</DialogTitle>
          <DialogDescription>
            Add tracks to it before you invite students.
          </DialogDescription>
        </DialogHeader>
        <CreateCohortForm creation={creation} />
      </DialogContent>
    </Dialog>
  );
}
