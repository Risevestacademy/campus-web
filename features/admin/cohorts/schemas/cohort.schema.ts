import { z } from "zod";

import { cohortStatusSchema, paginationMetaSchema } from "@/core/api/schemas";

import type {
  CohortEditRead,
  CohortFieldErrors,
  CohortFieldValues,
  CohortPage,
  CohortPatch,
  CohortSummary,
  NewCohort,
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

const cohortDate = z.iso.date("Enter a valid date.").optional();

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

function formText(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

function optionalFormText(form: FormData, field: string): string | undefined {
  return formText(form, field) || undefined;
}

function readCohortFields(form: FormData) {
  const startDate = optionalFormText(form, "startDate");
  const endDate = optionalFormText(form, "endDate");

  return cohortFieldsSchema.safeParse({
    name: formText(form, "name"),
    code: formText(form, "code"),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    status: formText(form, "status"),
  });
}

function firstErrorPerField(issues: z.ZodError["issues"]): CohortFieldErrors {
  const errors: CohortFieldErrors = {};
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
  return parsed.success
    ? { cohorts: parsed.data.items, ...parsed.data.meta }
    : undefined;
}

export function parseNewCohort(form: FormData): NewCohortRead {
  const parsed = readCohortFields(form);

  return parsed.success
    ? { kind: "valid", cohort: parsed.data }
    : { kind: "invalid", errors: firstErrorPerField(parsed.error.issues) };
}

export function parseCohortEdit(
  form: FormData,
  cohort: CohortSummary,
): CohortEditRead {
  const parsed = readCohortFields(form);
  if (!parsed.success) {
    return {
      kind: "invalid",
      errors: firstErrorPerField(parsed.error.issues),
    };
  }

  const values = parsed.data;
  const changes: CohortPatch = {};

  if (values.name !== cohort.name) changes.name = values.name;
  if (values.code !== cohort.code) changes.code = values.code;
  if ((values.startDate ?? null) !== cohort.startDate) {
    changes.startDate = values.startDate ?? null;
  }
  if ((values.endDate ?? null) !== cohort.endDate) {
    changes.endDate = values.endDate ?? null;
  }
  if (values.status !== cohort.status) changes.status = values.status;

  return Object.keys(changes).length === 0
    ? { kind: "unchanged" }
    : { kind: "valid", changes };
}
