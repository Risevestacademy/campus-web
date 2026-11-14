import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { MemberProfileCard } from "./member-profile-card";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const CARD_URL = `${TEST_ORIGIN}/api/v1/users/u-2/profile`;
const card = {
  id: "u-2",
  email: "grace@campus.local",
  firstName: "Grace",
  lastName: "Hopper",
  displayName: "Grace H.",
  bio: "Compilers, mostly.",
  avatarUrl: null,
  spriteKey: null,
  memberships: [
    {
      role: "student",
      cohort: { id: "c-1", name: "Cohort 2026", code: "C26" },
      track: { id: "t-1", name: "Backend", code: "BE" },
    },
  ],
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

function answer(reply: () => Response) {
  mockApi.server.use(http.get(CARD_URL, reply));
}

function renderCard() {
  render(
    withQueryClient(
      <Popover>
        <PopoverTrigger>Grace</PopoverTrigger>
        <PopoverContent>
          <MemberProfileCard
            actions={<button type="button">Go to</button>}
            avatarClassName=""
            cohortId="c-1"
            initial="G"
            name="grace"
            presence={{ badgeClassName: "bg-error", label: "Busy · 4 min" }}
            userId="u-2"
          />
        </PopoverContent>
      </Popover>,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Grace" }));
  return screen.findByRole("dialog");
}

describe("MemberProfileCard", () => {
  it("names them, their role and track, their status and their bio", async () => {
    answer(() => HttpResponse.json(card));
    const dialog = await renderCard();

    expect(
      await within(dialog).findByText("“Compilers, mostly.”"),
    ).toBeVisible();
    expect(dialog).toHaveAccessibleName("Grace H.");
    expect(within(dialog).getByText("Student · Backend")).toBeVisible();
    expect(within(dialog).getByText("Busy · 4 min")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Go to" })).toBeVisible();
    expect(within(dialog).getByText("Desk D-04")).toBeVisible();
  });

  it("keeps the caller's name while the card is read", async () => {
    answer(() => HttpResponse.json(card));
    const dialog = await renderCard();

    expect(dialog).toHaveAccessibleName("grace");
    expect(within(dialog).getByText("Loading profile…")).toBeVisible();
  });

  it("says so when the card is not there", async () => {
    answer(() => new HttpResponse(null, { status: 404 }));
    const dialog = await renderCard();

    expect(
      await within(dialog).findByText("This profile isn't available."),
    ).toBeVisible();
    expect(dialog).toHaveAccessibleName("grace");
  });

  it("says so when the card cannot be read", async () => {
    answer(() => new HttpResponse(null, { status: 500 }));
    const dialog = await renderCard();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "We couldn't load this profile. Close it and try again.",
    );
  });
});
