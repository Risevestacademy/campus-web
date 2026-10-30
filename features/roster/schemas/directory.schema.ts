import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

export type DirectoryPerson = Simplify<
  Pick<components["schemas"]["CohortProfileDto"], "id" | "displayName">
>;

const directoryPersonSchema = z.toZod<DirectoryPerson>()(
  z.object({
    id: z.string().min(1),
    displayName: z.string().nullable(),
  }),
);

// Each profile also carries a sprite; the roster reads only the name.
export function parseCohortDirectory(
  body: unknown,
): DirectoryPerson[] | undefined {
  return z.array(directoryPersonSchema).safeParse(body).data;
}
