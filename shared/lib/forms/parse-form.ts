import { z } from "zod";

type Field<S extends z.ZodObject> = keyof S["shape"] & string;

export type FormErrors<S extends z.ZodObject> = Partial<
  Record<Field<S>, string>
>;

export type FormRead<S extends z.ZodObject> =
  | { kind: "valid"; data: z.output<S> }
  | { kind: "invalid"; errors: FormErrors<S>; formError?: string };

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

// A missing field stays undefined so a required schema reports it, rather
// than "" coercing to 0 or passing as an empty string.
function readFields(fields: string[], form: FormData) {
  return Object.fromEntries(
    fields.map((field) => {
      const values = form.getAll(field);
      return [field, values.length > 1 ? values : values[0]];
    }),
  );
}

function firstErrorPerField<S extends z.ZodObject>(
  schema: S,
  fieldErrors: Record<string, string[] | undefined>,
): FormErrors<S> {
  return Object.entries(fieldErrors).reduce<FormErrors<S>>(
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
