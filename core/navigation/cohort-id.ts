import { z } from "zod";

const cohortIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

export function parseCohortId(value: unknown): string | undefined {
  return cohortIdSchema.safeParse(value).data;
}
