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

// With a limit, a longer value shows the given message, counted after trimming
// as the server counts it.
export const optionalText = (limit?: { max: number; error: string }) =>
  emptyAsUndefined(limit ? z.string().max(limit.max, limit.error) : z.string());

export const optionalIsoDate = (error: string) =>
  emptyAsUndefined(z.iso.date(error));
