// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import type { InviteRequest } from "../types/invite.types";
import { sendInvites } from "./send-invites.service";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const INVITES_URL = `${API_ORIGIN}/v1/invites`;
const api = createApiClient({ baseUrl: API_ORIGIN });

function request(email: string): InviteRequest {
  return { email, cohortId: "c-1", cohortRole: "professor" };
}

const REQUESTS = ["a@c.io", "b@c.io", "c@c.io"].map(request);

function fail(status: number, code: string) {
  return Response.json({ error: { code } }, { status });
}

function bodiesSent() {
  return mockApi.requests.filter(({ method }) => method === "POST");
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("sending several invites", () => {
  it("sends one request per address, in order, and counts them", async () => {
    const order: string[] = [];
    mockApi.server.use(
      http.post(INVITES_URL, async ({ request: incoming }) => {
        order.push(((await incoming.json()) as InviteRequest).email);
        return Response.json({ emailStatus: "sent" }, { status: 201 });
      }),
    );

    expect(await sendInvites(api, REQUESTS)).toEqual({
      kind: "done",
      sent: 3,
      notEmailed: 0,
      failures: [],
    });
    expect(order).toEqual(["a@c.io", "b@c.io", "c@c.io"]);
  });

  it("counts invites whose email did not go out", async () => {
    mockApi.server.use(
      http.post(INVITES_URL, () =>
        Response.json({ emailStatus: "failed" }, { status: 201 }),
      ),
    );

    expect(await sendInvites(api, REQUESTS.slice(0, 2))).toMatchObject({
      sent: 2,
      notEmailed: 2,
    });
  });

  it("names the address that failed and still sends the others", async () => {
    mockApi.server.use(
      http.post(INVITES_URL, async ({ request: incoming }) => {
        const { email } = (await incoming.json()) as InviteRequest;
        return email === "b@c.io"
          ? fail(409, "CONFLICT")
          : Response.json({ emailStatus: "sent" }, { status: 201 });
      }),
    );

    expect(await sendInvites(api, REQUESTS)).toEqual({
      kind: "done",
      sent: 2,
      notEmailed: 0,
      failures: [{ email: "b@c.io", problem: "conflict" }],
    });
    expect(bodiesSent()).toHaveLength(3);
  });

  it("stops at a problem with the request as a whole, and reports the rest as not sent", async () => {
    let calls = 0;
    mockApi.server.use(
      http.post(INVITES_URL, () => {
        calls += 1;
        return calls === 1
          ? Response.json({ emailStatus: "sent" }, { status: 201 })
          : fail(403, "FORBIDDEN");
      }),
    );

    expect(await sendInvites(api, REQUESTS)).toEqual({
      kind: "done",
      sent: 1,
      notEmailed: 0,
      failures: [
        { email: "b@c.io", problem: "forbidden" },
        { email: "c@c.io", problem: "forbidden" },
      ],
    });
    expect(bodiesSent()).toHaveLength(2);
  });

  it("stops when the connection fails", async () => {
    mockApi.server.use(http.post(INVITES_URL, () => HttpResponse.error()));

    expect(await sendInvites(api, REQUESTS)).toMatchObject({
      sent: 0,
      failures: [
        { email: "a@c.io", problem: "unavailable" },
        { email: "b@c.io", problem: "unavailable" },
        { email: "c@c.io", problem: "unavailable" },
      ],
    });
    expect(bodiesSent()).toHaveLength(1);
  });

  it("stops on a rate limit", async () => {
    mockApi.server.use(http.post(INVITES_URL, () => fail(429, "RATE_LIMITED")));

    expect(await sendInvites(api, REQUESTS)).toMatchObject({
      failures: [
        { problem: "rate-limited" },
        { problem: "rate-limited" },
        { problem: "rate-limited" },
      ],
    });
    expect(bodiesSent()).toHaveLength(1);
  });

  it("ends at once when the session has lapsed", async () => {
    mockApi.server.use(http.post(INVITES_URL, () => fail(401, "UNAUTHORIZED")));

    expect(await sendInvites(api, REQUESTS)).toEqual({ kind: "signed-out" });
    expect(bodiesSent()).toHaveLength(1);
  });
});
