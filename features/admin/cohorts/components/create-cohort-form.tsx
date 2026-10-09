"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";

import type { CohortCreationControls } from "../hooks/use-create-cohort";
import { parseNewCohort } from "../schemas/cohort.schema";
import type {
  CohortCreationProblem,
  NewCohortErrors,
} from "../types/cohort.types";
import { CohortFormFields } from "./cohort-form-fields";

const DUPLICATE_CODE = "Another cohort already uses this code.";
const PROBLEM_MESSAGES: Record<CohortCreationProblem, string | undefined> = {
  "duplicate-code": undefined,
  "signed-out": undefined,
  rejected: "campus-api rejected these details. Check the dates and try again.",
  forbidden: "You no longer have permission to create Cohorts.",
  unavailable:
    "We couldn't create the cohort. Nothing was saved. Check your connection and try again.",
};

export function CreateCohortForm({
  creation,
}: {
  creation: CohortCreationControls;
}) {
  const [errors, setErrors] = useState<NewCohortErrors>({});
  const { isPending, problem } = creation;
  const codeError =
    errors.code ?? (problem === "duplicate-code" ? DUPLICATE_CODE : undefined);
  const problemMessage = problem ? PROBLEM_MESSAGES[problem] : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const read = parseNewCohort(new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    if (read.kind === "valid") creation.create(read.cohort);
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      {problemMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {problemMessage}
        </p>
      ) : null}
      <CohortFormFields
        idPrefix="new-cohort"
        errors={{ ...errors, code: codeError }}
      />
      <DialogFooter>
        <DialogClose disabled={isPending} render={<Button variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create cohort"}
        </Button>
      </DialogFooter>
    </form>
  );
}
