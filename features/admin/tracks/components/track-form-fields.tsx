import { useId } from "react";

import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

import type { TrackFieldErrors, TrackFieldValues } from "../types/track.types";

export function TrackFormFields({
  values,
  errors = {},
}: {
  values?: Partial<TrackFieldValues>;
  errors?: TrackFieldErrors;
}) {
  const id = useId();

  return (
    <FieldGroup>
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          name="name"
          defaultValue={values?.name}
          placeholder="Frontend Development"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          required
        />
      </Field>
      <Field data-invalid={Boolean(errors.code)}>
        <FieldLabel htmlFor={`${id}-code`}>Code</FieldLabel>
        <Input
          id={`${id}-code`}
          name="code"
          defaultValue={values?.code}
          placeholder="FE"
          autoComplete="off"
          aria-invalid={Boolean(errors.code)}
          required
        />
      </Field>
      <Field data-invalid={Boolean(errors.description)}>
        <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
        <Textarea
          id={`${id}-description`}
          name="description"
          defaultValue={values?.description}
          placeholder="What this track covers"
          aria-invalid={Boolean(errors.description)}
        />
      </Field>
      {Object.entries(errors).map(([field, message]) =>
        message ? <FieldError key={field}>{message}</FieldError> : null,
      )}
    </FieldGroup>
  );
}
