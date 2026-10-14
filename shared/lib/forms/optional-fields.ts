import { z } from "zod";

// A pipe, not a union with z.literal(""): a union reports "Invalid input"
// instead of the field's own message. The outer .optional() keeps the key
// optional in the output type, which z.toZod compares exactly.
function emptyAsUndefined(schema: z.ZodType<string, string>) {
  return z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(schema.optional())
    .optional();
}

export const optionalText = () => emptyAsUndefined(z.string());

export const optionalIsoDate = (error: string) =>
  emptyAsUndefined(z.iso.date(error));
