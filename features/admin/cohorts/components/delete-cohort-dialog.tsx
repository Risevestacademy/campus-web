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

import { useDeleteCohort } from "../hooks/use-delete-cohort";
import type {
  CohortMutationProblem,
  CohortSummary,
} from "../types/cohort.types";

const PROBLEM_MESSAGES: Partial<Record<CohortMutationProblem, string>> = {
  invalid: "The Cohort identifier is invalid.",
  forbidden: "You no longer have permission to delete Cohorts.",
  missing: "This Cohort no longer exists. Refresh the catalogue.",
  conflict:
    "This Cohort still has Programme Tracks, members, or Invitations. Remove those associations before deleting it.",
};

export function DeleteCohortDialog({
  cohort,
  open,
  onOpenChange,
}: {
  cohort: CohortSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deletion = useDeleteCohort({
    cohort,
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
          <DialogTitle>Delete {cohort.name}?</DialogTitle>
          <DialogDescription>
            This deletion is permanent. It never cascades to Programme Tracks,
            members, or Invitations.
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
            {deletion.isPending ? "Deleting…" : "Delete cohort"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
