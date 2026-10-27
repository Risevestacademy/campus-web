import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

export type CohortPerson = Simplify<
  Pick<components["schemas"]["CohortProfileDto"], "id" | "displayName">
>;

const cohortPersonSchema = z.toZod<CohortPerson>()(
  z.object({
    id: z.string().min(1),
    displayName: z.string().nullable(),
  }),
);

// The sidebar's profile list also carries sprites; the picker reads a name.
export function parseCohortPeople(body: unknown): CohortPerson[] | undefined {
  return z.array(cohortPersonSchema).safeParse(body).data;
}
