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

// The Google photo. Only an https address is drawn; anything else falls back
// to the initial rather than failing the whole profile.
export const photoUrlSchema = z
  .url({ protocol: /^https$/ })
  .nullable()
  .catch(null);

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

// The longest each field may be, as campus-api's UpdateProfileDto caps them.
// The form sets these as maxLength too.
export const PROFILE_FIELD_LIMITS = {
  firstName: 80,
  lastName: 80,
  displayName: 80,
  bio: 500,
  // An optional + and up to 23 more characters.
  phone: 24,
} as const satisfies Partial<Record<keyof ProfileFieldValues, number>>;

// UpdateProfileDto's own pattern, so a number the form takes is one campus-api
// takes: an optional +, then a digit, then 5 to 22 more digits, spaces,
// hyphens or brackets.
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,22}$/;

function limitedText(field: keyof typeof PROFILE_FIELD_LIMITS, label: string) {
  const max = PROFILE_FIELD_LIMITS[field];
  return optionalText({
    max,
    error: `Keep your ${label} to ${max} characters or fewer.`,
  });
}

const profileFieldsSchema = z.toZod<ProfileFieldValues>()(
  z.object({
    firstName: limitedText("firstName", "first name"),
    lastName: limitedText("lastName", "last name"),
    displayName: limitedText("displayName", "display name"),
    bio: limitedText("bio", "bio"),
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
            "Enter a full phone number that starts with + or a digit, like +234 801 234 5678.",
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
