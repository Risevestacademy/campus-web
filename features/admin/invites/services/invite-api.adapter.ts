import type { ApiClient } from "@/core/api/client";
import { type ExceptionCode, parseExceptionCode } from "@/core/api/schemas";

import { parseEmailed, parseInvites } from "../schemas/invite.schema";
import type {
  InviteCountRead,
  InviteRecordProblem,
  InviteResend,
  InviteResendProblem,
  InviteRevoke,
  InviteRevokeProblem,
  InvitesListRead,
  InviteTab,
} from "../types/invite.types";

export const INVITES_PAGE_SIZE = 20;

export async function listInvites(
  api: ApiClient,
  cohortId: string,
  status: InviteTab,
  page: number,
  perPage = INVITES_PAGE_SIZE,
): Promise<InvitesListRead> {
  try {
    const { data, response } = await api.GET("/v1/invites", {
      params: { query: { cohortId, status, page, perPage } },
    });
    const invites = response.ok ? parseInvites(data) : undefined;
    return invites ? { kind: "loaded", ...invites } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function countInvites(
  api: ApiClient,
  cohortId: string,
  status: InviteTab,
): Promise<InviteCountRead> {
  const read = await listInvites(api, cohortId, status, 1, 1);
  return read.kind === "loaded"
    ? { kind: "loaded", total: read.total }
    : { kind: "unavailable" };
}

const COMMON_PROBLEMS: Readonly<Partial<Record<number, InviteRecordProblem>>> =
  {
    400: "invalid",
    401: "signed-out",
    403: "forbidden",
    404: "missing",
  };

const SETTLED_CODES: readonly ExceptionCode[] = [
  "INVITE_ALREADY_ACCEPTED",
  "INVITE_ALREADY_DECLINED",
  "INVITE_REVOKED",
];

function resendProblem(status: number, code?: ExceptionCode) {
  if (status === 409) {
    if (code === "CONFLICT") return "conflict";
    if (code && SETTLED_CODES.includes(code)) return "settled";
    return "unavailable";
  }
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

function revokeProblem(status: number, code?: ExceptionCode) {
  if (status === 403 && code === "INVITE_EXPIRED") return "expired";
  if (status === 409) return "settled";
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

export async function resendInvite(
  api: ApiClient,
  id: string,
): Promise<InviteResend> {
  try {
    const { data, error, response } = await api.POST(
      "/v1/invites/{id}/resend",
      { params: { path: { id } } },
    );
    if (response.ok) {
      return { kind: "resent", emailed: parseEmailed(data) ?? false };
    }
    return {
      kind: "problem",
      problem: resendProblem(
        response.status,
        parseExceptionCode(error),
      ) satisfies InviteResendProblem,
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function revokeInvite(
  api: ApiClient,
  id: string,
): Promise<InviteRevoke> {
  try {
    const { error, response } = await api.POST("/v1/invites/{id}/revoke", {
      params: { path: { id } },
    });
    if (response.ok) return { kind: "revoked" };
    return {
      kind: "problem",
      problem: revokeProblem(
        response.status,
        parseExceptionCode(error),
      ) satisfies InviteRevokeProblem,
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
