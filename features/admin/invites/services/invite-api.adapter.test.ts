// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  countInvites,
  createInvite,
  importInvites,
  listGroupOptions,
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

describe("create", () => {
  const body = {
    email: "ada@campus.local",
    cohortId: "c-1",
    cohortRole: "student" as const,
  };

  it("sends the request as given and reports whether the email went out", async () => {
    mockApi.server.use(
      http.post(INVITES_URL, async ({ request }) => {
        expect(await request.json()).toEqual(body);
        return Response.json({ emailStatus: "sent" }, { status: 201 });
      }),
    );

    expect(await createInvite(api, body)).toEqual({
      kind: "created",
      emailed: true,
    });
  });

  it("reports an invite whose email did not go out", async () => {
    mockApi.server.use(
      http.post(INVITES_URL, () =>
        Response.json({ emailStatus: "disabled" }, { status: 201 }),
      ),
    );

    expect(await createInvite(api, body)).toEqual({
      kind: "created",
      emailed: false,
    });
  });

  it.each([
    [409, "CONFLICT", "conflict"],
    [409, "SOMETHING_ELSE", "unavailable"],
    [429, "RATE_LIMITED", "rate-limited"],
    [404, "NOT_FOUND", "missing"],
    [403, "FORBIDDEN", "forbidden"],
    [401, "UNAUTHORIZED", "signed-out"],
    [400, "INVALID_ARGUMENT", "invalid"],
    [500, "INTERNAL_ERROR", "unavailable"],
  ])("maps a %i %s to %s", async (status, code, problem) => {
    mockApi.server.use(http.post(INVITES_URL, failure(status, code)));

    expect(await createInvite(api, body)).toEqual({
      kind: "problem",
      problem,
    });
  });

  it("never throws on a network failure", async () => {
    mockApi.server.use(http.post(INVITES_URL, () => HttpResponse.error()));

    expect(await createInvite(api, body)).toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("mentorship group options", () => {
  const url = `${API_ORIGIN}/v1/cohorts/c-1/mentorship-groups`;

  it("labels each group with its mentor and keeps nothing else", async () => {
    mockApi.server.use(
      http.get(url, () =>
        Response.json({
          items: [
            {
              id: "g-1",
              cohortId: "c-1",
              name: "Pod C",
              description: "private",
              mentor: {
                cohortMemberId: "m-1",
                user: {
                  id: "u-1",
                  email: "catherine@campus.local",
                  firstName: "Catherine",
                  lastName: "Onyeulo",
                  displayName: null,
                  avatarUrl: null,
                  status: "active",
                },
              },
              students: [],
              createdAt: "2026-10-01T00:00:00.000Z",
              updatedAt: "2026-10-01T00:00:00.000Z",
            },
          ],
          meta: { page: 1, perPage: 100, total: 1, totalPages: 1 },
        }),
      ),
    );

    expect(await listGroupOptions(api, "c-1")).toEqual({
      kind: "loaded",
      options: [{ id: "g-1", name: "Pod C", mentorName: "Catherine" }],
    });
  });

  it("reads every page of groups, not only the first", async () => {
    const group = (id: string) => ({
      id,
      cohortId: "c-1",
      name: `Pod ${id}`,
      description: null,
      mentor: {
        cohortMemberId: "m-1",
        user: {
          id: "u-1",
          email: "catherine@campus.local",
          firstName: "Catherine",
          lastName: "Onyeulo",
          displayName: null,
          avatarUrl: null,
          status: "active",
        },
      },
      students: [],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const asked: string[] = [];
    mockApi.server.use(
      http.get(url, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        asked.push(String(page));
        return Response.json({
          items: [group(`g-${page}`)],
          meta: { page, perPage: 100, total: 2, totalPages: 2 },
        });
      }),
    );

    const read = await listGroupOptions(api, "c-1");

    expect(asked).toEqual(["1", "2"]);
    expect(read.kind === "loaded" && read.options.map(({ id }) => id)).toEqual([
      "g-1",
      "g-2",
    ]);
  });

  it("is unavailable when the read fails or the body is malformed", async () => {
    mockApi.server.use(
      http.get(url, () => new HttpResponse(null, { status: 500 })),
    );
    expect((await listGroupOptions(api, "c-1")).kind).toBe("unavailable");

    mockApi.server.use(http.get(url, () => Response.json({ items: 1 })));
    expect((await listGroupOptions(api, "c-1")).kind).toBe("unavailable");
  });
});

describe("import", () => {
  const url = `${INVITES_URL}/import`;
  const file = new File(
    ["email,role\nada@campus.local,student\n"],
    "cohort.csv",
    {
      type: "text/csv",
    },
  );

  function imported(rows: unknown[]) {
    return Response.json({
      total: rows.length,
      invited: rows.filter(
        (row) => (row as { outcome: string }).outcome === "invited",
      ).length,
      failed: rows.filter(
        (row) => (row as { outcome: string }).outcome === "failed",
      ).length,
      rows,
    });
  }

  it("uploads the file and the cohort as multipart form data", async () => {
    mockApi.server.use(
      http.post(url, async ({ request }) => {
        expect(request.headers.get("content-type")).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        const form = await request.formData();
        expect(form.get("cohortId")).toBe("c-1");
        const sent = form.get("file") as File;
        expect(sent.name).toBe("cohort.csv");
        expect(await sent.text()).toContain("ada@campus.local,student");
        return imported([]);
      }),
    );

    expect((await importInvites(api, "c-1", file)).kind).toBe("imported");
  });

  it("reports who was invited, who was not and why, and keeps no link", async () => {
    mockApi.server.use(
      http.post(url, () =>
        imported([
          {
            line: 2,
            email: "ada@campus.local",
            outcome: "invited",
            inviteId: "i-1",
            inviteLink: "https://campus.example/invitation?token=secret",
            emailStatus: "sent",
          },
          {
            line: 3,
            email: "grace@campus.local",
            outcome: "invited",
            inviteId: "i-2",
            inviteLink: "https://campus.example/invitation?token=secret2",
            emailStatus: "failed",
          },
          {
            line: 4,
            email: "lin@campus.local",
            outcome: "failed",
            reason: "A pending invite already exists for lin@campus.local",
          },
        ]),
      ),
    );

    expect(await importInvites(api, "c-1", file)).toEqual({
      kind: "imported",
      invited: 2,
      notEmailed: 1,
      failed: [
        {
          line: 4,
          email: "lin@campus.local",
          reason: "A pending invite already exists for lin@campus.local",
        },
      ],
    });
  });

  it.each([
    [400, "INVALID_ARGUMENT", "unreadable"],
    [403, "FORBIDDEN", "forbidden"],
    [404, "NOT_FOUND", "missing"],
    [401, "UNAUTHORIZED", "signed-out"],
    [429, "RATE_LIMITED", "rate-limited"],
    [500, "INTERNAL_ERROR", "unavailable"],
  ])("maps a %i %s to %s", async (status, code, problem) => {
    mockApi.server.use(http.post(url, failure(status, code)));

    expect(await importInvites(api, "c-1", file)).toEqual({
      kind: "problem",
      problem,
    });
  });

  it("is unavailable when the answer is not an import result, or the network fails", async () => {
    mockApi.server.use(http.post(url, () => Response.json({ total: "x" })));
    expect(await importInvites(api, "c-1", file)).toEqual({
      kind: "problem",
      problem: "unavailable",
    });

    mockApi.server.use(http.post(url, () => HttpResponse.error()));
    expect(await importInvites(api, "c-1", file)).toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
