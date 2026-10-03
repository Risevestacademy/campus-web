import { z } from "zod";

import type {
  CohortPage,
  CohortStatus,
  NewCohort,
  NewCohortErrors,
  NewCohortRead,
} from "../types/cohort.types";

const FIRST_PAGE = 1;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

export const COHORT_STATUSES = [
  "upcoming",
  "active",
  "completed",
] as const satisfies readonly CohortStatus[];

const cohortListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      code: z.string(),
    }),
  ),
  meta: z.object({
    page: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const cohortDate = z.iso.date("Enter a valid date.").optional();

// YYYY-MM-DD strings sort as dates, so no Date (and no timezone) is involved.
const newCohortSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a cohort name."),
    code: z
      .string()
      .trim()
      .min(1, "Enter a cohort code.")
      .transform((code) => code.toUpperCase()),
    startDate: cohortDate,
    endDate: cohortDate,
    status: z.enum(COHORT_STATUSES, "Choose a status."),
  })
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || endDate >= startDate,
    {
      path: ["endDate"],
      error: "End date must be on or after the start date.",
    },
  );

// An empty input means "not set", so it is left out rather than sent as "".
function filledEntries(form: FormData): Record<string, string> {
  return Object.fromEntries(
    [...form.entries()].filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

function firstErrorPerField(issues: z.ZodError["issues"]): NewCohortErrors {
  const errors: NewCohortErrors = {};
  for (const { path, message } of issues) {
    const field = path[0] as keyof NewCohort;
    errors[field] ??= message;
  }
  return errors;
}

export function parseChooserPage(value: string | undefined): number {
  if (!value || !POSITIVE_INTEGER.test(value)) return FIRST_PAGE;

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : FIRST_PAGE;
}

export function parseCohortList(body: unknown): CohortPage | undefined {
  const parsed = cohortListSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { items, meta } = parsed.data;
  return {
    cohorts: items.map(({ id, name, code }) => ({ id, name, code })),
    page: meta.page,
    totalPages: meta.totalPages,
  };
}

export function parseNewCohort(form: FormData): NewCohortRead {
  const { name = "", code = "", ...optional } = filledEntries(form);
  const parsed = newCohortSchema.safeParse({ name, code, ...optional });

  return parsed.success
    ? { kind: "valid", cohort: parsed.data }
    : { kind: "invalid", errors: firstErrorPerField(parsed.error.issues) };
}
