import { z } from "zod";

import { cohortRoleSchema } from "@/core/api/schemas";
import { changedFields } from "@/shared/lib/changed-fields";
import { optionalText, parseForm } from "@/shared/lib/forms";

import type {
  OwnProfile,
  OwnProfileSummary,
  ProfileEditRead,
  ProfileFieldValues,
} from "../types";

const ownProfileSchema = z.toZod<OwnProfile>()(
  z.object({
    id: z.string().min(1),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    phone: z.string().nullable(),
    // The Google photo. Only an https address is drawn; anything else falls
    // back to the initial rather than failing the whole profile.
    avatarUrl: z
      .url({ protocol: /^https$/ })
      .nullable()
      .catch(null),
    memberships: z.array(
      z.object({
        role: cohortRoleSchema,
        cohort: z.object({ id: z.string().min(1), name: z.string() }),
        track: z.object({ name: z.string() }).nullable(),
      }),
    ),
  }),
);

export function parseOwnProfile(body: unknown): OwnProfile | undefined {
  return ownProfileSchema.safeParse(body).data;
}

// What campus-api takes: digits, with an optional leading + and spaces,
// hyphens or brackets between them.
const PHONE_PATTERN = /^\+?[\d\s()-]*\d[\d\s()-]*$/;

const profileFieldsSchema = z.toZod<ProfileFieldValues>()(
  z.object({
    firstName: optionalText(),
    lastName: optionalText(),
    displayName: optionalText(),
    bio: optionalText(),
    // A pipe, as optionalText does, so a blank phone clears it and a bad one
    // shows its own message rather than "Invalid input".
    phone: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(
        z
          .string()
          .regex(
            PHONE_PATTERN,
            "Use digits, with an optional + at the start and spaces or hyphens between them.",
          )
          .optional(),
      )
      .optional(),
  }),
);

export function parseProfileEdit(
  profile: OwnProfile,
  form: FormData,
): ProfileEditRead {
  const read = parseForm(profileFieldsSchema, form);
  if (read.kind === "invalid") return read;

  const changes = changedFields(profile, read.data);
  return Object.keys(changes).length > 0
    ? { kind: "valid", changes }
    : { kind: "unchanged" };
}

export function summaryOf(
  profile: OwnProfile,
  cohortId: string,
): OwnProfileSummary {
  const place = profile.memberships.find(
    (membership) => membership.cohort.id === cohortId,
  );
  return {
    avatarUrl: profile.avatarUrl,
    displayName: profile.displayName,
    email: profile.email,
    place: place
      ? [place.track?.name, place.cohort.name].filter(Boolean).join(" · ")
      : null,
  };
}
