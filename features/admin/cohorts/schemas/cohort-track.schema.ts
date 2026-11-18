import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

import { trackSummarySchema } from "../../tracks/schemas/track.schema";
import type {
  CohortTrackAssociation,
  CohortTrackCollection,
} from "../types/cohort-track.types";

type CohortTrackDetail = Simplify<
  Pick<
    components["schemas"]["CohortDetailResponseDto"],
    "id" | "name" | "code"
  > & { tracks: CohortTrackAssociation[] }
>;

const cohortTrackCollectionSchema = z.toZod<CohortTrackDetail>()(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    code: z.string(),
    tracks: z.array(
      z.object({ id: z.string().min(1), track: trackSummarySchema }),
    ),
  }),
);

export function parseCohortTrackCollection(
  body: unknown,
): CohortTrackCollection | undefined {
  const parsed = cohortTrackCollectionSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { tracks, ...cohort } = parsed.data;
  return { cohort, tracks };
}
