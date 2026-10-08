import type { components } from "@/core/api/client";
import type {
  InvitePreview,
  PendingInvite,
} from "@/features/invitation/types/invite.types";

type Schemas = components["schemas"];

// Shapes copied from campus-api responses for /v1/invites/*.
export function invitePreview(
  overrides: Partial<InvitePreview> = {},
): InvitePreview {
  return {
    email: "ada@campus.local",
    cohort: {
      name: "Cohort 2",
      code: "C2",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    },
    track: { name: "Backend Engineering", code: "BE" },
    cohortRole: "student",
    systemRole: "user",
    invitedBy: { firstName: "Ejemen", lastName: "Iboi" },
    expiresAt: "2026-10-07T19:58:13.568Z",
    guestAccessExpiresAt: null,
    ...overrides,
  };
}

export function pendingInvite(
  overrides: Partial<PendingInvite> = {},
): PendingInvite {
  return {
    id: "2b339f4a-d1e1-4763-a68e-5bfe0480b7fd",
    cohort: {
      id: "c-1",
      name: "Cohort 2",
      code: "C2",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: "2026-09-30T19:42:23.147Z",
      updatedAt: "2026-09-30T19:42:23.147Z",
    },
    cohortTrack: {
      id: "6c6323cb-b359-4d27-a6f0-28c98399c1f5",
      cohortId: "c-1",
      trackId: "2542ea51-c59f-42a4-a72a-d87601e57e79",
      createdAt: "2026-09-30T19:52:17.890Z",
    },
    track: {
      id: "2542ea51-c59f-42a4-a72a-d87601e57e79",
      name: "Backend Engineering",
      code: "BE",
      description: "Backend engineering track",
      createdAt: "2026-09-30T19:48:52.980Z",
      updatedAt: "2026-09-30T19:48:52.980Z",
    },
    cohortRole: "student",
    systemRole: "user",
    status: "pending",
    expiresAt: "2026-10-07T19:58:13.568Z",
    guestAccessExpiresAt: null,
    invitedBy: {
      id: "b59d4da6-6f3f-46da-b179-d0b4b5b2ff51",
      firstName: "Ejemen",
      lastName: "Iboi",
    },
    createdAt: "2026-09-30T19:58:13.565Z",
    user: {
      id: "6a85a881-2903-4a76-aca9-116af6a7228b",
      email: "ada@campus.local",
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      systemRole: "user",
      status: "active",
      createdAt: "2026-09-30T20:08:05.033Z",
    },
    ...overrides,
  };
}

export function acceptedDecision(
  cohortId: string | null,
): Schemas["InviteDecisionResponseDto"] {
  return {
    inviteId: pendingInvite().id,
    status: "accepted",
    decidedAt: "2026-10-03T12:00:00.000Z",
    membership: cohortId
      ? {
          cohortId,
          role: "student",
          cohortTrackId: null,
          status: "active",
          joinedAt: "2026-10-03T12:00:00.000Z",
          accessExpiresAt: null,
        }
      : null,
    systemRole: "user",
  };
}
