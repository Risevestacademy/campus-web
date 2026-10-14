import { z } from "zod";

import { cohortStatusSchema, paginationMetaSchema } from "@/core/api/schemas";
import { changedFields } from "@/shared/lib/changed-fields";
import { optionalIsoDate, parseForm } from "@/shared/lib/forms";
import { withoutUndefined } from "@/shared/lib/without-undefined";

import type {
  CohortEditRead,
  CohortFieldValues,
  CohortPage,
  CohortSummary,
  NewCohortRead,
} from "../types/cohort.types";

const FIRST_PAGE = 1;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

export const COHORT_STATUSES = cohortStatusSchema.options;

const cohortSummarySchema = z.toZod<CohortSummary>()(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    code: z.string(),
    startDate: z.iso.date().nullable(),
    endDate: z.iso.date().nullable(),
    status: cohortStatusSchema,
  }),
);

const cohortListSchema = z.object({
  items: z.array(cohortSummarySchema),
  meta: paginationMetaSchema,
});

const cohortDate = optionalIsoDate("Enter a valid date.");

// YYYY-MM-DD strings sort as dates, so no Date (and no timezone) is involved.
const cohortFieldsSchema = z.toZod<CohortFieldValues>()(
  z
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
      ({ startDate, endDate }) =>
        !startDate || !endDate || endDate >= startDate,
      {
        path: ["endDate"],
        error: "End date must be on or after the start date.",
      },
    ),
);

export function parseChooserPage(value: string | undefined): number {
  if (!value || !POSITIVE_INTEGER.test(value)) return FIRST_PAGE;

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : FIRST_PAGE;
}

export function parseCohortList(body: unknown): CohortPage | undefined {
  const parsed = cohortListSchema.safeParse(body);
  return parsed.success
    ? { cohorts: parsed.data.items, ...parsed.data.meta }
    : undefined;
}

export function parseNewCohort(form: FormData): NewCohortRead {
  const read = parseForm(cohortFieldsSchema, form);
  return read.kind === "valid"
    ? { kind: "valid", cohort: withoutUndefined(read.data) }
    : read;
}

export function parseCohortEdit(
  cohort: CohortSummary,
  form: FormData,
): CohortEditRead {
  const read = parseForm(cohortFieldsSchema, form);
  if (read.kind === "invalid") return read;

  const changes = changedFields(cohort, read.data);
  return Object.keys(changes).length > 0
    ? { kind: "valid", changes }
    : { kind: "unchanged" };
}
