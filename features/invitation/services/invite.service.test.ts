// @vitest-environment node

import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";
import {
  acceptedDecision,
  invitePreview,
  pendingInvite,
} from "@/tests/fixtures/invites";
import type { Reply } from "@/tests/fixtures/mock-api";

import {
  acceptInvite,
  previewInvite,
  readPendingInvite,
} from "./invite.service";

// Status codes map to problems once for all three routes; the invitation eval
// walks every answer through every route, so this file covers request and
// response shape only.

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const PREVIEW_URL = `${API_ORIGIN}/v1/invites/preview`;
const VALIDATE_URL = `${API_ORIGIN}/v1/invites/validate-user-invite`;
const DECISION_URL = `${API_ORIGIN}/v1/invites/decision`;
const TOKEN = "Aj2Q1WN2qnVm6pDv2Bbou2QrXj20GDxBe5ZYX8YLN6I";
const INVITE_ID = pendingInvite().id;

const api = createApiClient({ baseUrl: API_ORIGIN });

const json =
  (body: unknown): Reply =>
  () =>
    Response.json(body);

function capturingBody(url: string, reply: unknown) {
  const sent: unknown[] = [];
  mockApi.server.use(
    http.post(url, async ({ request }) => {
      sent.push(await request.json());
      return Response.json(reply);
    }),
  );
  return sent;
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("previewInvite", () => {
  it("posts the token in the body, never the URL", async () => {
    const sent = capturingBody(PREVIEW_URL, invitePreview());

    await previewInvite(api, TOKEN);

    expect(sent).toEqual([{ token: TOKEN }]);
    expect(mockApi.requests.map(({ url }) => url)).toEqual([PREVIEW_URL]);
  });

  it("accepts an admin invite with no cohort, track, or inviter name", async () => {
    const adminInvite = invitePreview({
      cohort: null,
      track: null,
      cohortRole: null,
      systemRole: "admin",
      invitedBy: { firstName: null, lastName: null },
    });
    mockApi.server.use(http.post(PREVIEW_URL, json(adminInvite)));

    await expect(previewInvite(api, TOKEN)).resolves.toEqual({
      kind: "loaded",
      invite: adminInvite,
    });
  });
});

describe("readPendingInvite", () => {
  it("reads the invite the session carries", async () => {
    mockApi.server.use(http.get(VALIDATE_URL, json(pendingInvite())));

    await expect(readPendingInvite(api)).resolves.toEqual({
      kind: "loaded",
      invite: pendingInvite(),
    });
  });

  it("treats a pending invite without an id as unusable", async () => {
    mockApi.server.use(
      http.get(VALIDATE_URL, json({ ...pendingInvite(), id: "" })),
    );

    await expect(readPendingInvite(api)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("acceptInvite", () => {
  it("accepts the invite the visitor saw, by id", async () => {
    const sent = capturingBody(DECISION_URL, acceptedDecision("c-1"));

    await acceptInvite(api, INVITE_ID);

    expect(sent).toEqual([{ decision: "accept", inviteId: INVITE_ID }]);
  });

  it.each([
    ["a cohort place to its campus entry", "c-1", "/campus/c-1"],
    ["a cohort ID as one path segment", "a/b c?d", "/campus/a%2Fb%20c%3Fd"],
    ["an admin invite with no cohort place to Campus", null, "/campus"],
  ])("sends %s", async (_, cohortId, destination) => {
    mockApi.server.use(
      http.post(DECISION_URL, json(acceptedDecision(cohortId))),
    );

    await expect(acceptInvite(api, INVITE_ID)).resolves.toEqual({
      kind: "accepted",
      destination,
    });
  });

  it("does not treat a decline answer as an accept", async () => {
    mockApi.server.use(
      http.post(
        DECISION_URL,
        json({ ...acceptedDecision(null), status: "declined" }),
      ),
    );

    await expect(acceptInvite(api, INVITE_ID)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
