import { z } from "zod";

import { paginationMetaSchema } from "@/core/api/schemas";
import { changedFields } from "@/shared/lib/changed-fields";
import { optionalText, parseForm } from "@/shared/lib/forms";
import { withoutUndefined } from "@/shared/lib/without-undefined";

import type {
  NewTrackRead,
  TrackEditRead,
  TrackFieldValues,
  TrackPage,
  TrackSummary,
} from "../types/track.types";

export const trackSummarySchema = z.toZod<TrackSummary>()(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    code: z.string(),
    description: z.string().nullable(),
  }),
);

const trackListSchema = z.object({
  items: z.array(trackSummarySchema),
  meta: paginationMetaSchema,
});

const trackFieldsSchema = z.toZod<TrackFieldValues>()(
  z.object({
    name: z.string().trim().min(1, "Enter a programme track name."),
    code: z
      .string()
      .trim()
      .min(1, "Enter a programme track code.")
      .transform((value) => value.toUpperCase()),
    description: optionalText(),
  }),
);

export function parseNewTrack(form: FormData): NewTrackRead {
  const read = parseForm(trackFieldsSchema, form);
  return read.kind === "valid"
    ? { kind: "valid", track: withoutUndefined(read.data) }
    : read;
}

export function parseTrackEdit(
  track: TrackSummary,
  form: FormData,
): TrackEditRead {
  const read = parseForm(trackFieldsSchema, form);
  if (read.kind === "invalid") return read;

  const changes = changedFields(track, read.data);
  return Object.keys(changes).length > 0
    ? { kind: "valid", changes }
    : { kind: "unchanged" };
}

export function parseTrackList(body: unknown): TrackPage | undefined {
  const parsed = trackListSchema.safeParse(body);
  return parsed.success
    ? { tracks: parsed.data.items, ...parsed.data.meta }
    : undefined;
}
