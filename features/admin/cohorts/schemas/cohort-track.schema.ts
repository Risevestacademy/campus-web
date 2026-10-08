import { z } from "zod";

import type { CohortTrackCollection } from "../types/cohort-track.types";

const cohortTrackCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  code: z.string(),
  tracks: z.array(
    z.object({
      id: z.string().min(1),
      track: z.object({
        id: z.string().min(1),
        name: z.string(),
        code: z.string(),
        description: z.string().nullable(),
      }),
    }),
  ),
});

export function parseCohortTrackCollection(
  body: unknown,
): CohortTrackCollection | undefined {
  const parsed = cohortTrackCollectionSchema.safeParse(body);
  if (!parsed.success) return undefined;

  return {
    cohort: {
      id: parsed.data.id,
      name: parsed.data.name,
      code: parsed.data.code,
    },
    tracks: parsed.data.tracks,
  };
}
