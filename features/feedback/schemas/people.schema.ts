import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

export type CohortPerson = Simplify<
  Pick<components["schemas"]["CohortProfileDto"], "id" | "displayName">
>;

const cohortPersonSchema = z.toZod<CohortPerson>()(
  z.object({
    id: z.uuid(),
    displayName: z.string().nullable(),
  }),
);

// Each profile also carries a sprite; the picker reads only the name.
export function parseCohortPeople(body: unknown): CohortPerson[] | undefined {
  return z.array(cohortPersonSchema).safeParse(body).data;
}
