import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { presenceFor } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { useUnreadNotifications } from "../unread-notifications";
import { NotificationsPanel } from "./notifications-panel";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const LIST_URL = `${TEST_ORIGIN}/api/v1/notifications`;
const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const NEW_NOTIFICATION: ServerMessage = {
  type: "notification",
  id: "n-2",
  kind: "entry_request_declined",
  context: null,
};

let nextCohort = 0;
// The registry keeps one store per cohort for the whole file.
const newCohort = () => `cohort-${nextCohort++}`;

function entry(id: string, kind: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind,
    referenceType: "entry_request",
    referenceId: "r-1",
    context: null,
    read: false,
    createdAt: new Date(NOW - 5 * 60_000).toISOString(),
    ...extra,
  };
}

function pageOf(items: unknown[], overrides: Record<string, number> = {}) {
  return {
    items,
    meta: {
      page: 1,
      perPage: 20,
      total: items.length,
      totalPages: 1,
      ...overrides,
    },
  };
}

// Answers `?unread=true` with the unread among the notifications, and the rest
// with the whole list, the way campus-api does.
function serveList(
  all: () => Array<ReturnType<typeof entry>>,
  onRequest?: (search: URLSearchParams) => void,
) {
  mockApi.server.use(
    http.get(LIST_URL, ({ request }) => {
      const search = new URL(request.url).searchParams;
      onRequest?.(search);
      const items =
        search.get("unread") === "true" ? all().filter((n) => !n.read) : all();
      return HttpResponse.json(pageOf(items));
    }),
  );
}

function Panel({ cohortId }: { cohortId: string }) {
  const unread = useUnreadNotifications(cohortId);
  return (
    <>
      <p data-testid="badge">{unread}</p>
      <NotificationsPanel
        cohortId={cohortId}
        collapseButton={<button type="button">Collapse</button>}
      />
    </>
  );
}

function renderPanel(cohortId: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  return render(withQueryClient(<Panel cohortId={cohortId} />));
}

afterEach(() => {
  vi.useRealTimers();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("NotificationsPanel", () => {
  it("lists each notification in words, newest first, with the unread marked", async () => {
    const cohortId = newCohort();
    presenceFor(cohortId)
      .getState()
      .apply({
        ...serverFrames.snapshot,
        spaces: [{ spaceKey: "library", name: "Library" }],
      });
    serveList(() => [
      entry("n-1", "entry_request_admitted", {
        context: { cohortId, spaceKey: "library" },
      }),
      entry("n-2", "entry_request_declined", {
        context: { cohortId, spaceKey: "library" },
        read: true,
      }),
      entry("n-3", "notice_posted", { referenceType: "notice" }),
    ]);

    renderPanel(cohortId);

    expect(await screen.findByText("You were let into Library.")).toBeVisible();
    expect(
      screen.getByText("Your request to enter Library was declined."),
    ).toBeVisible();
    expect(screen.getByText("A new notice was posted.")).toBeVisible();
    expect(screen.getAllByText("5 minutes ago")).toHaveLength(3);
    // Only the unread are pressable, and the count says how many.
    expect(
      screen.getByRole("button", {
        name: "Mark as read: You were let into Library.",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /Mark as read: Your request to enter Library was declined/,
      }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("2 unread")).toBeVisible();
    expect(screen.getByTestId("badge")).toHaveTextContent("2");
  });

  it("calls a space in another cohort by what it is, not by its key", async () => {
    const cohortId = newCohort();
    serveList(() => [
      entry("n-1", "entry_request_admitted", {
        context: { cohortId: "another-cohort", spaceKey: "library" },
      }),
    ]);

    renderPanel(cohortId);

    expect(
      await screen.findByText("You were let into a space in another cohort."),
    ).toBeVisible();
  });

  it("shows a kind it does not know as a plain alert", async () => {
    serveList(() => [entry("n-1", "calendar_invite")]);

    renderPanel(newCohort());

    expect(
      await screen.findByText("You have a new notification."),
    ).toBeVisible();
  });

  it("says when there is nothing yet", async () => {
    serveList(() => []);

    renderPanel(newCohort());

    expect(await screen.findByText(/Nothing yet\./)).toBeVisible();
    expect(screen.getByText("You're all caught up.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
  });

  it("says so and offers to try again when the list cannot be read", async () => {
    let failing = true;
    mockApi.server.use(
      http.get(LIST_URL, () =>
        failing
          ? new Response(null, { status: 503 })
          : HttpResponse.json(pageOf([entry("n-1", "notice_posted")])),
      ),
    );

    renderPanel(newCohort());

    expect(
      await screen.findByText("We couldn't load your notifications."),
    ).toBeVisible();
    failing = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("A new notice was posted.")).toBeVisible();
  });

  it("reads one by pressing it, and reads the list again", async () => {
    const notifications = [entry("n-1", "notice_posted")];
    const patched: string[] = [];
    serveList(() => notifications);
    mockApi.server.use(
      http.patch(`${LIST_URL}/:id/read`, ({ params }) => {
        patched.push(String(params.id));
        const found = notifications.find(({ id }) => id === params.id);
        if (found) found.read = true;
        return HttpResponse.json(found);
      }),
    );
    renderPanel(newCohort());

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Mark as read: A new notice was posted.",
      }),
    );

    await waitFor(() => expect(patched).toEqual(["n-1"]));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Mark as read/ }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("0");
  });

  it("reads them all at once", async () => {
    const notifications = [
      entry("n-1", "notice_posted"),
      entry("n-2", "notice_posted"),
    ];
    let marked = 0;
    serveList(() => notifications);
    mockApi.server.use(
      http.post(`${LIST_URL}/read-all`, () => {
        marked += 1;
        for (const notification of notifications) notification.read = true;
        return HttpResponse.json({ marked: 2 });
      }),
    );
    renderPanel(newCohort());

    const markAll = await screen.findByRole("button", {
      name: "Mark all as read",
    });
    await waitFor(() => expect(markAll).toBeEnabled());
    fireEvent.click(markAll);

    await waitFor(() => expect(marked).toBe(1));
    expect(await screen.findByText("You're all caught up.")).toBeVisible();
  });

  it("reads the list again when world says a new one was written", async () => {
    const cohortId = newCohort();
    const notifications = [entry("n-1", "notice_posted", { read: true })];
    serveList(() => notifications);
    renderPanel(cohortId);
    await screen.findByText("A new notice was posted.");
    expect(screen.getByTestId("badge")).toHaveTextContent("0");

    notifications.unshift(
      entry("n-2", "entry_request_declined", {
        context: { cohortId, spaceKey: "library" },
      }),
    );
    act(() => presenceFor(cohortId).getState().apply(NEW_NOTIFICATION));

    expect(
      await screen.findByText("Your request to enter library was declined."),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId("badge")).toHaveTextContent("1"),
    );
  });

  it("keeps what is on screen while the new list loads", async () => {
    const cohortId = newCohort();
    serveList(() => [entry("n-1", "notice_posted")]);
    renderPanel(cohortId);
    await screen.findByText("A new notice was posted.");
    mockApi.server.use(
      http.get(LIST_URL, () => new Promise<Response>(() => {})),
    );

    act(() => presenceFor(cohortId).getState().apply(NEW_NOTIFICATION));

    expect(screen.getByText("A new notice was posted.")).toBeVisible();
  });

  it("shows older ones a page at a time", async () => {
    const requested: string[] = [];
    mockApi.server.use(
      http.get(LIST_URL, ({ request }) => {
        const search = new URL(request.url).searchParams;
        requested.push(search.toString());
        if (search.get("unread") === "true")
          return HttpResponse.json(pageOf([]));
        const pageNumber = Number(search.get("page"));
        return HttpResponse.json(
          pageOf([entry(`n-${pageNumber}`, "notice_posted", { read: true })], {
            page: pageNumber,
            totalPages: 2,
            total: 2,
          }),
        );
      }),
    );
    renderPanel(newCohort());
    await screen.findByText("A new notice was posted.");

    fireEvent.click(screen.getByRole("button", { name: "Show older" }));

    await waitFor(() =>
      expect(screen.getAllByText("A new notice was posted.")).toHaveLength(2),
    );
    expect(requested).toContain("page=2&perPage=20");
    expect(
      screen.queryByRole("button", { name: "Show older" }),
    ).not.toBeInTheDocument();
  });

  it("puts the sidebar's collapse button in the header", async () => {
    serveList(() => []);

    renderPanel(newCohort());

    expect(
      await screen.findByRole("button", { name: "Collapse" }),
    ).toBeVisible();
  });
});
