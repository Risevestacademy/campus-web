import { render, screen } from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";
import { invitePreview } from "@/tests/fixtures/invites";
import type { Reply } from "@/tests/fixtures/mock-api";

import { InvitationOffer } from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const PREVIEW_URL = `${API_ORIGIN}/v1/invites/preview`;
const TOKEN = "zHrjwba-bzFiiuyT5wb1OiuUQUdS619_DNNd0C6sFg0";

const api = createApiClient({ baseUrl: API_ORIGIN });

const failure =
  (status: number, code: string): Reply =>
  () =>
    Response.json({ error: { code, message: "scripted" } }, { status });

function previewReplies(reply: Reply) {
  mockApi.server.use(http.post(PREVIEW_URL, reply));
}

async function renderOffer(token = TOKEN) {
  render(await InvitationOffer({ api, token }));
}

function chips() {
  return screen.getAllByRole("listitem").map((chip) => chip.textContent);
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("InvitationOffer: a live invitation", () => {
  it("names the track, cohort, inviter, and role from the invitation", async () => {
    previewReplies(() => Response.json(invitePreview()));

    await renderOffer();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "You're invited to join Backend Engineering Cohort 2",
      }),
    ).toBeVisible();
    expect(chips()).toEqual([
      "Invited by • Ejemen Iboi",
      "Role • Student",
      "Cohort 2",
    ]);
    expect(
      screen.getByText(
        /This invitation gives you a Student seat in this cohort;/,
      ),
    ).toBeVisible();
  });

  it("names the cohort alone for a role without a track", async () => {
    previewReplies(() =>
      Response.json(invitePreview({ track: null, cohortRole: "mentor" })),
    );

    await renderOffer();

    expect(
      screen.getByRole("heading", { name: "You're invited to join Cohort 2" }),
    ).toBeVisible();
    expect(
      screen.getByText(/gives you a Mentor seat in this cohort/),
    ).toBeVisible();
  });

  it("keeps the Cohort label on a cohort name that does not say it", async () => {
    previewReplies(() =>
      Response.json(
        invitePreview({
          cohort: { name: "Product Design 2026", code: "PD26" },
        }),
      ),
    );

    await renderOffer();

    expect(chips()).toContain("Cohort • Product Design 2026");
  });

  it("starts Google sign-in as a full browser navigation", async () => {
    previewReplies(() => Response.json(invitePreview()));

    await renderOffer();

    expect(
      screen.getByRole("link", { name: "Continue with Google" }),
    ).toHaveAttribute("href", "/api/v1/auth/google");
  });

  it("describes an admin invite, which joins no cohort", async () => {
    previewReplies(() =>
      Response.json(
        invitePreview({ cohort: null, cohortRole: null, systemRole: "admin" }),
      ),
    );

    await renderOffer();

    expect(
      screen.getByRole("heading", { name: "You're invited to Campus" }),
    ).toBeVisible();
    expect(chips()).toEqual(["Invited by • Ejemen Iboi", "Role • Admin"]);
  });

  it("leaves out the inviter when the invitation carries no name", async () => {
    previewReplies(() =>
      Response.json(
        invitePreview({ invitedBy: { firstName: null, lastName: null } }),
      ),
    );

    await renderOffer();

    expect(chips()).toEqual(["Role • Student", "Cohort 2"]);
  });
});

// The screen for each failure is covered by the invitation eval; only the
// retry link's token encoding lives here.
describe("InvitationOffer: an outage", () => {
  it("offers a retry of the same link, token encoded", async () => {
    previewReplies(failure(503, "INTERNAL_ERROR"));

    await renderOffer("token with/odd&chars");

    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/invitation?token=token+with%2Fodd%26chars",
    );
  });
});
