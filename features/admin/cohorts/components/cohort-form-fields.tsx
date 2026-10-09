import type { HTMLInputTypeAttribute } from "react";

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

import { COHORT_STATUSES } from "../schemas/cohort.schema";
import type {
  CohortFieldErrors,
  CohortFieldValues,
  CohortStatus,
} from "../types/cohort.types";

const STATUS_LABELS: Record<CohortStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

interface TextFieldProps {
  idPrefix: string;
  name: Exclude<keyof CohortFieldValues, "status">;
  label: string;
  defaultValue?: string | null;
  error?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  inputClassName?: string;
}

function TextField({
  idPrefix,
  name,
  label,
  defaultValue,
  error,
  type = "text",
  placeholder,
  inputClassName,
}: TextFieldProps) {
  const inputId = `${idPrefix}-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
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

export function CohortFormFields({
  idPrefix,
  values,
  errors,
}: {
  idPrefix: string;
  values?: Partial<CohortFieldValues>;
  errors: CohortFieldErrors;
}) {
  const status = values?.status ?? "upcoming";

  return (
    <FieldGroup>
      <TextField
        idPrefix={idPrefix}
        name="name"
        label="Name"
        defaultValue={values?.name}
        placeholder="Cohort 1"
        error={errors.name}
      />
      <TextField
        idPrefix={idPrefix}
        name="code"
        label="Code"
        defaultValue={values?.code}
        placeholder="C1"
        error={errors.code}
        inputClassName="uppercase"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          idPrefix={idPrefix}
          name="startDate"
          label="Start date"
          type="date"
          defaultValue={values?.startDate}
          error={errors.startDate}
        />
        <TextField
          idPrefix={idPrefix}
          name="endDate"
          label="End date"
          type="date"
          defaultValue={values?.endDate}
          error={errors.endDate}
        />
      </div>
      <FieldSet>
        <FieldLegend variant="label">Status</FieldLegend>
        <RadioGroup
          name="status"
          defaultValue={status}
          className="flex flex-wrap gap-x-6"
        >
          {COHORT_STATUSES.map((candidate) => (
            <Field key={candidate} orientation="horizontal" className="w-fit">
              <RadioGroupItem
                id={`${idPrefix}-status-${candidate}`}
                value={candidate}
              />
              <FieldLabel htmlFor={`${idPrefix}-status-${candidate}`}>
                {STATUS_LABELS[candidate]}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    </FieldGroup>
  );
}
