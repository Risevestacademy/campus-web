import type { ApiClient } from "@/core/api/client";

import {
  parseAcceptedCohort,
  parseErrorCode,
  parseInvitePreview,
  parsePendingInvite,
} from "../schemas/invite.schema";
import type {
  InviteAcceptance,
  InvitePreview,
  InviteProblem,
  InviteRead,
  PendingInvite,
} from "../types/invite.types";

interface ApiAnswer {
  data?: unknown;
  error?: unknown;
  response: Response;
}

const CAMPUS_HOME_PATH = "/campus";

// campus-api answers every invite route with the same 409 vocabulary.
const CONFLICT_PROBLEMS: Readonly<Record<string, InviteProblem>> = {
  INVITE_ALREADY_ACCEPTED: "already-accepted",
  INVITE_ALREADY_DECLINED: "closed",
  INVITE_REVOKED: "closed",
  CONFLICT: "already-member",
};

function classifyFailure(status: number, error: unknown): InviteProblem {
  switch (status) {
    case 401:
      return "signed-out";
    case 403:
      return "expired";
    case 404:
      return "not-found";
    case 409:
      return CONFLICT_PROBLEMS[parseErrorCode(error) ?? ""] ?? "unavailable";
    default:
      return "unavailable";
  }
}

const problem = (reason: InviteProblem) =>
  ({ kind: "problem", problem: reason }) as const;

// openapi-fetch throws alike for a network failure and an unparseable success
// body; both leave the visitor with nothing to act on.
async function readInvite<Invite>(
  send: () => Promise<ApiAnswer>,
  parse: (body: unknown) => Invite | undefined,
): Promise<InviteRead<Invite>> {
  try {
    const { data, error, response } = await send();
    if (!response.ok) return problem(classifyFailure(response.status, error));

    const invite = parse(data);
    return invite === undefined
      ? problem("unavailable")
      : { kind: "loaded", invite };
  } catch {
    return problem("unavailable");
  }
}

export function previewInvite(
  api: ApiClient,
  token: string,
): Promise<InviteRead<InvitePreview>> {
  return readInvite(
    () => api.POST("/v1/invites/preview", { body: { token } }),
    parseInvitePreview,
  );
}

export function readPendingInvite(
  api: ApiClient,
): Promise<InviteRead<PendingInvite>> {
  return readInvite(
    () => api.GET("/v1/invites/validate-user-invite"),
    parsePendingInvite,
  );
}

function campusDestination(cohortId: string | null): string {
  return cohortId
    ? `/campus/${encodeURIComponent(cohortId)}/join`
    : CAMPUS_HOME_PATH;
}

// inviteId is sent even for a provisional session: a full-access member must
// name the invite they saw, so a replacement is never accepted unseen.
export async function acceptInvite(
  api: ApiClient,
  inviteId: string,
): Promise<InviteAcceptance> {
  const read = await readInvite(
    () =>
      api.POST("/v1/invites/decision", {
        body: { decision: "accept", inviteId },
      }),
    parseAcceptedCohort,
  );

  return read.kind === "loaded"
    ? { kind: "accepted", destination: campusDestination(read.invite) }
    : read;
}
