import type { z } from "zod";

type Field<S extends z.ZodObject> = keyof S["shape"] & string;

export type FormErrors<S extends z.ZodObject> = Partial<
  Record<Field<S>, string>
>;

export type FormRead<S extends z.ZodObject> =
  | { kind: "valid"; data: z.output<S> }
  | { kind: "invalid"; errors: FormErrors<S> };

export function parseForm<S extends z.ZodObject>(
  schema: S,
  form: FormData,
): FormRead<S> {
  const parsed = schema.safeParse(readFields(Object.keys(schema.shape), form));
  return parsed.success
    ? { kind: "valid", data: parsed.data }
    : {
        kind: "invalid",
        errors: firstErrorPerField(schema, parsed.error.issues),
      };
}

function readFields(fields: string[], form: FormData) {
  return Object.fromEntries(
    fields.map((field) => [field, form.get(field) ?? ""]),
  );
}

function firstErrorPerField<S extends z.ZodObject>(
  schema: S,
  issues: z.core.$ZodIssue[],
): FormErrors<S> {
  return issues.reduce<FormErrors<S>>((errors, { path, message }) => {
    const [field] = path;
    return isField(schema, field) && !Object.hasOwn(errors, field)
      ? { ...errors, [field]: message }
      : errors;
  }, {});
}

function isField<S extends z.ZodObject>(
  schema: S,
  key: PropertyKey | undefined,
): key is Field<S> {
  return typeof key === "string" && Object.hasOwn(schema.shape, key);
}
