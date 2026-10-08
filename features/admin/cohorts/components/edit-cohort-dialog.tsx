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

import { useEditCohort } from "../hooks/use-edit-cohort";
import { parseCohortEdit } from "../schemas/cohort.schema";
import type {
  CohortFieldErrors,
  CohortMutationProblem,
  CohortSummary,
} from "../types/cohort.types";
import { CohortFormFields } from "./cohort-form-fields";

const PROBLEM_MESSAGES: Partial<Record<CohortMutationProblem, string>> = {
  invalid:
    "campus-api rejected these changes. Review the fields and try again.",
  forbidden: "You no longer have permission to edit Cohorts.",
  missing: "This Cohort no longer exists. Refresh the catalogue.",
};

export function EditCohortDialog({
  cohort,
  open,
  onOpenChange,
}: {
  cohort: CohortSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [errors, setErrors] = useState<CohortFieldErrors>({});
  const [unchanged, setUnchanged] = useState(false);
  const editing = useEditCohort({
    cohort,
    onEdited: () => onOpenChange(false),
  });

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

    const read = parseCohortEdit(new FormData(event.currentTarget), cohort);
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
    (editing.problem === "conflict"
      ? "Another Cohort already uses this code."
      : undefined);
  const problemMessage = editing.problem
    ? PROBLEM_MESSAGES[editing.problem]
    : undefined;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {cohort.name}</DialogTitle>
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
            <p role="alert" className="text-foreground-secondary text-sm">
              Change at least one field before saving.
            </p>
          ) : null}
          <CohortFormFields
            idPrefix="edit-cohort"
            values={{
              name: cohort.name,
              code: cohort.code,
              startDate: cohort.startDate ?? undefined,
              endDate: cohort.endDate ?? undefined,
              status: cohort.status,
            }}
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
