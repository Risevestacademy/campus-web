import { z } from "zod";

type Field<S extends z.ZodObject> = keyof z.output<S> & string;

export type FormErrors<Values> = Partial<Record<keyof Values & string, string>>;

export interface FormInvalid<Values> {
  kind: "invalid";
  errors: FormErrors<Values>;
  formError?: string;
}

export type FormRead<S extends z.ZodObject> =
  { kind: "valid"; data: z.output<S> } | FormInvalid<z.output<S>>;

export function parseForm<S extends z.ZodObject>(
  schema: S,
  form: FormData,
): FormRead<S> {
  const parsed = schema.safeParse(readFields(Object.keys(schema.shape), form));
  if (parsed.success) return { kind: "valid", data: parsed.data };

  const { fieldErrors, formErrors } = z.flattenError(parsed.error);
  const [formError] = formErrors;
  return {
    kind: "invalid",
    errors: firstErrorPerField(schema, fieldErrors),
    ...(formError && { formError }),
  };
}

// A missing field (unticked checkbox, disabled input) reads as "" so the
// field's own .min() message shows, not Zod's "expected string".
function readFields(fields: string[], form: FormData) {
  return Object.fromEntries(
    fields.map((field) => [field, form.get(field) ?? ""]),
  );
}

function firstErrorPerField<S extends z.ZodObject>(
  schema: S,
  fieldErrors: Record<string, string[] | undefined>,
): FormErrors<z.output<S>> {
  return Object.entries(fieldErrors).reduce<FormErrors<z.output<S>>>(
    (errors, [field, messages]) =>
      isField(schema, field) && messages?.[0]
        ? { ...errors, [field]: messages[0] }
        : errors,
    {},
  );
}

function isField<S extends z.ZodObject>(
  schema: S,
  key: string,
): key is Field<S> {
  return Object.hasOwn(schema.shape, key);
}
