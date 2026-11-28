import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { PersonActions } from "@/features/admin/people/components/person-actions";
import type { MembershipActionsAvailable } from "@/features/admin/people/membership-actions";
import type { PersonActionsAvailable } from "@/features/admin/people/person-actions";
import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => sideEffects.push(`push ${href}`),
    refresh: () => sideEffects.push("refresh"),
  }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`go ${href}`),
}));

const MEMBER_URL = `${TEST_ORIGIN}/api/v1/cohorts/cohort-1/members/user-1`;
const NAME = "Ada Lovelace";
const VISIT_END = "2099-01-10T12:00:00.000Z";

const NO_ACCOUNT_ACTIONS: PersonActionsAvailable = {
  roleChange: undefined,
  suspend: false,
  reinstate: false,
};
const STUDENT: MembershipActionsAvailable = {
  moveTo: [{ id: "t-2", name: "Design" }],
  visitEnds: null,
  ends: ["graduate", "defer", "withdraw", "dismiss", "remove"],
};
const GUEST: MembershipActionsAvailable = {
  moveTo: [],
  visitEnds: VISIT_END,
  ends: ["remove"],
};

function renderActions(membership: MembershipActionsAvailable = STUDENT) {
  render(
    <>
      {withQueryClient(
        <PersonActions
          cohortId="cohort-1"
          userId="user-1"
          name={NAME}
          actions={NO_ACCOUNT_ACTIONS}
          membership={membership}
        />,
      )}
      <Toaster />
    </>,
  );
}

function choose(item: string) {
  fireEvent.click(screen.getByRole("button", { name: `Manage ${NAME}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

function confirm(name: string) {
  return screen.getByRole("button", { name });
}

function browserRequests() {
  return mockApi.requests.filter(({ url }) =>
    url.startsWith(`${TEST_ORIGIN}/api/`),
  );
}

function recordBodies(method: "post" | "patch", url: string, status = 200) {
  const bodies: unknown[] = [];
  mockApi.server.use(
    http[method](url, async ({ request }) => {
      bodies.push(await request.json());
      return status === 200
        ? Response.json({})
        : new HttpResponse(null, { status });
    }),
  );
  return bodies;
}

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
  sideEffects.length = 0;
});

afterAll(() => mockApi.close());

describe("End membership request eval (threshold: 0 extra fields; exactly 1 request per double click)", () => {
  it.each([
    ["graduate", "Mark as graduated", "Marked as graduated"],
    ["defer", "Defer", "Marked as deferred"],
    ["withdraw", "Withdraw", "Marked as withdrawn"],
    ["dismiss", "Dismiss", "Dismissed from the cohort"],
    ["remove", "Remove from cohort", "Removed from the cohort"],
  ] as const)(
    "posts a %s to its own endpoint with the trimmed reason, once, then refreshes",
    async (end, item, toastTitle) => {
      const bodies = recordBodies("post", `${MEMBER_URL}/${end}`);
      renderActions();

      choose(item);
      fireEvent.change(screen.getByRole("textbox", { name: /^Reason/ }), {
        target: { value: "  Moved abroad  " },
      });
      const button = screen
        .getByRole("dialog")
        .querySelector<HTMLButtonElement>("button[type=submit]");
      fireEvent.click(button!);
      fireEvent.click(button!);

      expect(await screen.findByText(toastTitle)).toBeVisible();
      expect(bodies).toEqual([{ reason: "Moved abroad" }]);
      expect(sideEffects).toEqual(["refresh"]);
      expect(browserRequests()).toHaveLength(1);
    },
  );

  it("sends no reason when an optional one is left blank", async () => {
    const bodies = recordBodies("post", `${MEMBER_URL}/withdraw`);
    renderActions();

    choose("Withdraw");
    fireEvent.click(confirm("Withdraw"));

    expect(await screen.findByText("Marked as withdrawn")).toBeVisible();
    expect(bodies).toEqual([{}]);
  });

  it("asks for a dismissal's reason without sending a request", async () => {
    renderActions();

    choose("Dismiss");
    fireEvent.click(confirm("Dismiss"));

    expect(
      await screen.findByText("Say why they are being dismissed."),
    ).toBeVisible();
    expect(browserRequests()).toHaveLength(0);
  });

  it.each([
    [
      409,
      "This membership has already ended, or can't end this way. Refresh the page.",
    ],
    [
      500,
      "We couldn't make this change. Nothing was changed. Check your connection and try again.",
    ],
  ])(
    "explains a %i in the dialog and does not refresh",
    async (status, message) => {
      recordBodies("post", `${MEMBER_URL}/graduate`, status);
      renderActions();

      choose("Mark as graduated");
      fireEvent.click(confirm("Mark as graduated"));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(sideEffects).toEqual([]);
    },
  );

  it("sends a signed-out admin to sign in", async () => {
    recordBodies("post", `${MEMBER_URL}/remove`, 401);
    renderActions();

    choose("Remove from cohort");
    fireEvent.click(confirm("Remove"));

    await vi.waitFor(() => expect(sideEffects).toEqual(["go /sign-in"]));
  });
});

describe("Change track request eval (threshold: 0 extra fields; 0 requests with no track chosen)", () => {
  it("sends only the chosen track, once", async () => {
    const bodies = recordBodies("patch", `${MEMBER_URL}/track`);
    renderActions();

    choose("Change track");
    fireEvent.click(confirm("Change track"));
    expect(await screen.findByText("Choose a track.")).toBeVisible();
    expect(browserRequests()).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("New track"), {
      target: { value: "t-2" },
    });
    const button = confirm("Change track");
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText("Track changed")).toBeVisible();
    expect(bodies).toEqual([{ trackId: "t-2" }]);
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });
});

describe("Extend visit request eval (threshold: 0 extra fields; 0 requests for an end that is not later)", () => {
  it("is offered to a guest and sends only the new end, as an instant", async () => {
    const bodies = recordBodies("patch", MEMBER_URL);
    renderActions(GUEST);

    choose("Extend visit");
    fireEvent.change(screen.getByLabelText("New end"), {
      target: { value: "2099-02-01T09:30" },
    });
    const button = confirm("Extend visit");
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText("Visit extended")).toBeVisible();
    expect(bodies).toEqual([
      { accessExpiresAt: new Date("2099-02-01T09:30").toISOString() },
    ]);
    expect(sideEffects).toEqual(["refresh"]);
    expect(browserRequests()).toHaveLength(1);
  });

  it("refuses an end before the current one without a request", async () => {
    renderActions(GUEST);

    choose("Extend visit");
    fireEvent.change(screen.getByLabelText("New end"), {
      target: { value: "2099-01-01T09:30" },
    });
    fireEvent.click(confirm("Extend visit"));

    expect(
      await screen.findByText(
        "Choose a time later than the visit's current end.",
      ),
    ).toBeVisible();
    expect(browserRequests()).toHaveLength(0);
  });

  it("says a visit that already ended needs a new invite", async () => {
    recordBodies("patch", MEMBER_URL, 409);
    renderActions(GUEST);

    choose("Extend visit");
    fireEvent.change(screen.getByLabelText("New end"), {
      target: { value: "2099-02-01T09:30" },
    });
    fireEvent.click(confirm("Extend visit"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This visit has already ended. Send them a new invite instead.",
    );
  });
});
