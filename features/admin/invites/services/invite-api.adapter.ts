import type { ApiClient } from "@/core/api/client";
import { type ExceptionCode, parseExceptionCode } from "@/core/api/schemas";

import { parseImport } from "../schemas/import.schema";
import { parseEmailed, parseInvites } from "../schemas/invite.schema";
import { parseGroupOptions } from "../schemas/mentorship-group.schema";
import type {
  InviteCountRead,
  InviteCreate,
  InviteCreateProblem,
  InviteGroupOption,
  InviteImportProblem,
  InviteImportRead,
  InviteOptionsRead,
  InviteRecordProblem,
  InviteRequest,
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

function createProblem(
  status: number,
  code?: ExceptionCode,
): InviteCreateProblem {
  if (status === 409) return code === "CONFLICT" ? "conflict" : "unavailable";
  if (status === 429 || code === "RATE_LIMITED") return "rate-limited";
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

export async function createInvite(
  api: ApiClient,
  invite: InviteRequest,
): Promise<InviteCreate> {
  try {
    const { data, error, response } = await api.POST("/v1/invites", {
      body: invite,
    });
    if (response.ok) {
      return { kind: "created", emailed: parseEmailed(data) ?? false };
    }
    return {
      kind: "problem",
      problem: createProblem(response.status, parseExceptionCode(error)),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

// The backend caps a page at 100 groups.
const GROUPS_PAGE_SIZE = 100;

export async function listGroupOptions(
  api: ApiClient,
  cohortId: string,
): Promise<InviteOptionsRead<InviteGroupOption>> {
  try {
    const { data, response } = await api.GET(
      "/v1/cohorts/{cohortId}/mentorship-groups",
      {
        params: {
          path: { cohortId },
          query: { page: 1, perPage: GROUPS_PAGE_SIZE },
        },
      },
    );
    const options = response.ok ? parseGroupOptions(data) : undefined;
    return options ? { kind: "loaded", options } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

function importProblem(
  status: number,
  code?: ExceptionCode,
): InviteImportProblem {
  if (status === 400) return "unreadable";
  if (status === 429 || code === "RATE_LIMITED") return "rate-limited";
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

// The file travels as multipart form data, which the typed client builds from
// this serializer: the body it is given only has to satisfy the schema.
export async function importInvites(
  api: ApiClient,
  cohortId: string,
  file: File,
): Promise<InviteImportRead> {
  try {
    const { data, error, response } = await api.POST("/v1/invites/import", {
      body: { cohortId, file: "" },
      bodySerializer: () => {
        const form = new FormData();
        form.append("cohortId", cohortId);
        form.append("file", file);
        return form;
      },
    });
    if (response.ok) {
      const imported = parseImport(data);
      return imported
        ? { kind: "imported", ...imported }
        : { kind: "problem", problem: "unavailable" };
    }
    return {
      kind: "problem",
      problem: importProblem(response.status, parseExceptionCode(error)),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
