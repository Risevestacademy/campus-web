import { z } from "zod";

import { cohortRoleSchema } from "@/core/api/schemas";

import type { MemberProfile } from "../types";
import { photoUrlSchema } from "./own-profile.schema";

const memberProfileSchema = z.toZod<MemberProfile>()(
  z.object({
    id: z.string().min(1),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: photoUrlSchema,
    memberships: z.array(
      z.object({
        role: cohortRoleSchema,
        cohort: z.object({ id: z.string().min(1) }),
        track: z.object({ name: z.string() }).nullable(),
      }),
    ),
  }),
);

export function parseMemberProfile(body: unknown): MemberProfile | undefined {
  return memberProfileSchema.safeParse(body).data;
}

export const ROLE_LABELS = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  guest: "Guest",
} as const;

// The card's name: the display name, else the full name, else what the
// caller already shows for them.
export function cardNameOf(profile: MemberProfile, fallback: string): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter((part) => part?.trim())
    .join(" ");
  return profile.displayName?.trim() || fullName || fallback;
}

// "Role · Track" in this cohort, the role alone without a track, or null when
// the viewer shares no place with them here.
export function roleLineOf(
  profile: MemberProfile,
  cohortId: string,
): string | null {
  const place = profile.memberships.find(
    (membership) => membership.cohort.id === cohortId,
  );
  if (!place) return null;
  return [ROLE_LABELS[place.role], place.track?.name]
    .filter(Boolean)
    .join(" · ");
}
