// @vitest-environment node

import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";
import {
  acceptedDecision,
  inviteFlagged,
  invitePreview,
  pendingInvite,
} from "@/tests/fixtures/invites";
import type { Reply } from "@/tests/fixtures/mock-api";

import {
  acceptInvite,
  flagInvite,
  previewInvite,
  readPendingInvite,
} from "./invite.service";

// Status codes map to problems once for every route; the invitation eval
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
const FLAG_URL = `${API_ORIGIN}/v1/invites/flag`;
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

    await expect(previewInvite(api, TOKEN)).resolves.toStrictEqual({
      kind: "loaded",
      invite: {
        cohort: null,
        track: null,
        cohortRole: null,
        systemRole: "admin",
        invitedBy: { firstName: null, lastName: null },
      },
    });
  });

  it("keeps the invitee's email and expiry out of the preview", async () => {
    mockApi.server.use(http.post(PREVIEW_URL, json(invitePreview())));

    await expect(previewInvite(api, TOKEN)).resolves.toStrictEqual({
      kind: "loaded",
      invite: {
        cohort: { name: "Cohort 2" },
        track: { name: "Backend Engineering" },
        cohortRole: "student",
        systemRole: "user",
        invitedBy: { firstName: "Ejemen", lastName: "Iboi" },
      },
    });
  });

  it("treats a track that is not an object as unusable", async () => {
    mockApi.server.use(
      http.post(PREVIEW_URL, json({ ...invitePreview(), track: "BE" })),
    );

    await expect(previewInvite(api, TOKEN)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});

describe("readPendingInvite", () => {
  it("reads the invite the session carries", async () => {
    mockApi.server.use(http.get(VALIDATE_URL, json(pendingInvite())));

    await expect(readPendingInvite(api)).resolves.toStrictEqual({
      kind: "loaded",
      invite: {
        id: "2b339f4a-d1e1-4763-a68e-5bfe0480b7fd",
        cohort: { name: "Cohort 2" },
        track: { name: "Backend Engineering" },
        cohortRole: "student",
        systemRole: "user",
        flaggedAt: null,
        user: {
          email: "ada@campus.local",
          displayName: "Ada Lovelace",
          firstName: "Ada",
          lastName: "Lovelace",
        },
      },
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

  it.each(["constructor", "__proto__", "toString"])(
    "treats a 409 coded %s as unavailable, not a prototype lookup",
    async (code) => {
      mockApi.server.use(
        http.post(DECISION_URL, () =>
          Response.json({ error: { code, message: "x" } }, { status: 409 }),
        ),
      );

      await expect(acceptInvite(api, INVITE_ID)).resolves.toEqual({
        kind: "problem",
        problem: "unavailable",
      });
    },
  );

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

describe("flagInvite", () => {
  const flag = { message: "Wrong track", inviteId: INVITE_ID };

  it("sends the message and the id of the invite the visitor saw, nothing else", async () => {
    const sent = capturingBody(FLAG_URL, inviteFlagged());

    await expect(flagInvite(api, flag)).resolves.toEqual({ kind: "flagged" });

    expect(sent).toEqual([{ message: "Wrong track", inviteId: INVITE_ID }]);
  });

  it("treats an invite that already carries a flag as flagged", async () => {
    mockApi.server.use(
      http.post(FLAG_URL, () =>
        Response.json(
          { error: { code: "CONFLICT", message: "x" } },
          { status: 409 },
        ),
      ),
    );

    await expect(flagInvite(api, flag)).resolves.toEqual({ kind: "flagged" });
  });

  it("treats a 400 as unavailable: the message was checked before sending", async () => {
    mockApi.server.use(
      http.post(FLAG_URL, () =>
        Response.json(
          { error: { code: "VALIDATION_ERROR", message: "x" } },
          { status: 400 },
        ),
      ),
    );

    await expect(flagInvite(api, flag)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });

  it("does not count an answer without flaggedAt as a flag", async () => {
    mockApi.server.use(
      http.post(FLAG_URL, json({ inviteId: INVITE_ID, flaggedAt: "" })),
    );

    await expect(flagInvite(api, flag)).resolves.toEqual({
      kind: "problem",
      problem: "unavailable",
    });
  });
});
