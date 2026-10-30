// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  countInvites,
  listInvites,
  resendInvite,
  revokeInvite,
} from "./invite-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const INVITES_URL = `${API_ORIGIN}/v1/invites`;
const api = createApiClient({ baseUrl: API_ORIGIN });

function page(items: unknown[], total = items.length) {
  return Response.json({
    items,
    meta: { page: 1, perPage: 20, total, totalPages: 1 },
  });
}

function failure(status: number, code: string) {
  return () => Response.json({ error: { code } }, { status });
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("invite list reads", () => {
  it("asks for one cohort's invites in one status and page", async () => {
    mockApi.server.use(
      http.get(INVITES_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("cohortId")).toBe("c-1");
        expect(query.get("status")).toBe("expired");
        expect(query.get("page")).toBe("2");
        return page([]);
      }),
    );

    expect((await listInvites(api, "c-1", "expired", 2)).kind).toBe("loaded");
  });

  it("counts with a page of one", async () => {
    mockApi.server.use(
      http.get(INVITES_URL, ({ request }) => {
        expect(new URL(request.url).searchParams.get("perPage")).toBe("1");
        return page([], 12);
      }),
    );

    expect(await countInvites(api, "c-1", "pending")).toEqual({
      kind: "loaded",
      total: 12,
    });
  });

  it("is unavailable when the read fails or the body is malformed", async () => {
    mockApi.server.use(
      http.get(INVITES_URL, () => new HttpResponse(null, { status: 500 })),
    );
    expect((await listInvites(api, "c-1", "pending", 1)).kind).toBe(
      "unavailable",
    );

    mockApi.server.use(
      http.get(INVITES_URL, () => Response.json({ items: 1 })),
    );
    expect((await listInvites(api, "c-1", "pending", 1)).kind).toBe(
      "unavailable",
    );
  });
});

describe("resend", () => {
  const url = `${INVITES_URL}/invite-1/resend`;

  it("reports whether the email went out", async () => {
    mockApi.server.use(
      http.post(url, () => Response.json({ emailStatus: "sent" })),
    );
    expect(await resendInvite(api, "invite-1")).toEqual({
      kind: "resent",
      emailed: true,
    });

    mockApi.server.use(
      http.post(url, () => Response.json({ emailStatus: "failed" })),
    );
    expect(await resendInvite(api, "invite-1")).toEqual({
      kind: "resent",
      emailed: false,
    });
  });

  it.each([
    [409, "CONFLICT", "conflict"],
    [409, "INVITE_REVOKED", "settled"],
    [409, "INVITE_ALREADY_ACCEPTED", "settled"],
    [409, "INVITE_ALREADY_DECLINED", "settled"],
    [409, "SOMETHING_ELSE", "unavailable"],
    [404, "NOT_FOUND", "missing"],
    [403, "FORBIDDEN", "forbidden"],
    [401, "UNAUTHORIZED", "signed-out"],
    [400, "INVALID_ARGUMENT", "invalid"],
    [500, "INTERNAL_ERROR", "unavailable"],
  ])("maps a %i %s to %s", async (status, code, problem) => {
    mockApi.server.use(http.post(url, failure(status, code)));

    expect(await resendInvite(api, "invite-1")).toEqual({
      kind: "problem",
      problem,
    });
  });

  it("never throws on a network failure", async () => {
    mockApi.server.use(http.post(url, () => HttpResponse.error()));

    expect(await resendInvite(api, "invite-1")).toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("revoke", () => {
  const url = `${INVITES_URL}/invite-1/revoke`;

  it("revokes", async () => {
    mockApi.server.use(
      http.post(url, () => Response.json({ status: "revoked" })),
    );

    expect(await revokeInvite(api, "invite-1")).toEqual({ kind: "revoked" });
  });

  it.each([
    [403, "INVITE_EXPIRED", "expired"],
    [403, "FORBIDDEN", "forbidden"],
    [409, "INVITE_REVOKED", "settled"],
    [404, "NOT_FOUND", "missing"],
    [401, "UNAUTHORIZED", "signed-out"],
    [500, "INTERNAL_ERROR", "unavailable"],
  ])("maps a %i %s to %s", async (status, code, problem) => {
    mockApi.server.use(http.post(url, failure(status, code)));

    expect(await revokeInvite(api, "invite-1")).toEqual({
      kind: "problem",
      problem,
    });
  });
});
