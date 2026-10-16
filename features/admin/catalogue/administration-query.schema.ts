import { z } from "zod";

import { FIRST_PAGE, pageNumberSchema } from "@/shared/lib/search-params";

const DEFAULT_QUERY = { view: "cohorts", page: FIRST_PAGE } as const;

// One bad parameter resets both, so a broken link never lands mid-way into Tracks.
const administrationQuerySchema = z
  .object({
    view: z.enum(["cohorts", "tracks"]).default(DEFAULT_QUERY.view),
    page: pageNumberSchema.default(FIRST_PAGE),
  })
  .catch(DEFAULT_QUERY);

export type AdministrationQuery = z.output<typeof administrationQuerySchema>;

export function parseAdministrationQuery(
  view: string | undefined,
  page: string | undefined,
): AdministrationQuery {
  return administrationQuerySchema.parse({ view, page });
}
