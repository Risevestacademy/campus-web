"use client";

import { type FormEvent, type HTMLInputTypeAttribute, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

import type { CohortCreationControls } from "../hooks/use-create-cohort";
import { COHORT_STATUSES, parseNewCohort } from "../schemas/cohort.schema";
import type {
  CohortStatus,
  NewCohort,
  NewCohortErrors,
} from "../types/cohort.types";

const STATUS_LABELS: Record<CohortStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

const DEFAULT_STATUS: CohortStatus = "upcoming";
const DUPLICATE_CODE = "Another cohort already uses this code.";
const REJECTED =
  "campus-api rejected these details. Check the dates and try again.";

interface TextFieldProps {
  name: keyof NewCohort;
  label: string;
  error: string | undefined;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  inputClassName?: string;
}

function TextField({
  name,
  label,
  error,
  type = "text",
  placeholder,
  inputClassName,
}: TextFieldProps) {
  const inputId = `new-cohort-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

function StatusField() {
  return (
    <FieldSet>
      <FieldLegend variant="label">Status</FieldLegend>
      <RadioGroup
        name="status"
        defaultValue={DEFAULT_STATUS}
        className="flex flex-wrap gap-x-6"
      >
        {COHORT_STATUSES.map((status) => (
          <Field key={status} orientation="horizontal" className="w-fit">
            <RadioGroupItem id={`new-cohort-status-${status}`} value={status} />
            <FieldLabel htmlFor={`new-cohort-status-${status}`}>
              {STATUS_LABELS[status]}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

export function CreateCohortForm({
  creation,
}: {
  creation: CohortCreationControls;
}) {
  const [errors, setErrors] = useState<NewCohortErrors>({});
  const { isPending, problem } = creation;
  const codeError =
    errors.code ?? (problem === "duplicate-code" ? DUPLICATE_CODE : undefined);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const read = parseNewCohort(new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    if (read.kind === "valid") creation.create(read.cohort);
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      {problem === "rejected" ? (
        <p role="alert" className="text-destructive text-sm">
          {REJECTED}
        </p>
      ) : null}
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          placeholder="Cohort 1"
          error={errors.name}
        />
        {/* Shown uppercase as typed; parseNewCohort uppercases the value. */}
        <TextField
          name="code"
          label="Code"
          placeholder="C1"
          error={codeError}
          inputClassName="uppercase"
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            name="startDate"
            label="Start date"
            type="date"
            error={errors.startDate}
          />
          <TextField
            name="endDate"
            label="End date"
            type="date"
            error={errors.endDate}
          />
        </div>
        <StatusField />
      </FieldGroup>
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
