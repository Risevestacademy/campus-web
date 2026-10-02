import { z } from "zod";

import type { CohortPage } from "../types/cohort.types";

const FIRST_PAGE = 1;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

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
