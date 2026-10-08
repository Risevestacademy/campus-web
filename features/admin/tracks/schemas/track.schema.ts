import { z } from "zod";

import type {
  NewTrackRead,
  TrackEditRead,
  TrackFieldErrors,
  TrackPage,
  TrackPatch,
  TrackSummary,
} from "../types/track.types";

const fields = z.object({
  name: z.string().trim().min(1, "Enter a programme track name."),
  code: z
    .string()
    .trim()
    .min(1, "Enter a programme track code.")
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().optional(),
});
function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
function errors(issues: z.ZodError["issues"]): TrackFieldErrors {
  const result: TrackFieldErrors = {};
  for (const issue of issues)
    result[issue.path[0] as keyof TrackFieldErrors] ??= issue.message;
  return result;
}
function read(form: FormData) {
  return fields.safeParse({
    name: text(form, "name"),
    code: text(form, "code"),
    description: text(form, "description") || undefined,
  });
}

function normalizeValues(values: {
  name: string;
  code: string;
  description?: string;
}) {
  return { ...values, description: values.description?.trim() || undefined };
}
export function parseNewTrack(
  form: FormData | { name: string; code: string; description?: string },
): NewTrackRead {
  const parsed =
    form instanceof FormData
      ? read(form)
      : fields.safeParse(normalizeValues(form));
  return parsed.success
    ? { kind: "valid", track: parsed.data }
    : { kind: "invalid", errors: errors(parsed.error.issues) };
}

export function parseTrackEdit(
  track: TrackSummary,
  values: FormData | { name: string; code: string; description?: string },
): TrackEditRead {
  const parsed =
    values instanceof FormData
      ? read(values)
      : fields.safeParse(normalizeValues(values));
  if (!parsed.success)
    return { kind: "invalid", errors: errors(parsed.error.issues) };
  const changes: TrackPatch = {};
  if (parsed.data.name !== track.name) changes.name = parsed.data.name;
  if (parsed.data.code !== track.code) changes.code = parsed.data.code;
  const description = parsed.data.description ?? null;
  if (description !== track.description) changes.description = description;
  return Object.keys(changes).length
    ? { kind: "valid", changes }
    : { kind: "unchanged" };
}

export function parseTrackList(body: unknown): TrackPage | undefined {
  const parsed = z
    .object({
      items: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string(),
          code: z.string(),
          description: z.string().nullable(),
        }),
      ),
      meta: z.object({
        page: z.number().int().positive(),
        totalPages: z.number().int().nonnegative(),
      }),
    })
    .safeParse(body);
  return parsed.success
    ? {
        tracks: parsed.data.items,
        page: parsed.data.meta.page,
        totalPages: parsed.data.meta.totalPages,
      }
    : undefined;
}
