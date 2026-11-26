import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSessionContext } from "@/core/session";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type {
  CalendarDisconnect,
  CalendarRead,
} from "../services/calendar-api.adapter";
import { resetCalendarView } from "../store/calendar-view-store";
import { CalendarPanel } from "./calendar-panel";

const adapter = vi.hoisted(() => ({
  disconnectCalendar: vi.fn(),
  readCalendarEvents: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("../services/calendar-api.adapter", () => adapter);
vi.mock("@/shared/ui/toast", () => ({ toast: toasts }));

function status(read: CalendarRead | { kind: "connected" }) {
  adapter.readCalendarEvents.mockResolvedValue(
    read.kind === "connected" && !("events" in read)
      ? { kind: "connected", events: [], truncated: false }
      : read,
  );
}

function renderPanel() {
  return render(
    withQueryClient(
      <RefreshSessionContext value={async () => ({ kind: "refreshed" })}>
        <CalendarPanel
          administrator={false}
          cohortId="c-1"
          collapseButton={<button type="button">Collapse sidebar</button>}
        />
      </RefreshSessionContext>,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 8, 30, 9, 55) });
  resetCalendarView();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarPanel", () => {
  it("says it is asking Google until the answer comes", () => {
    adapter.readCalendarEvents.mockReturnValue(new Promise(() => undefined));

    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent("Checking Google…");
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  it("says a connected calendar is connected and when it loaded", async () => {
    status({ kind: "connected" });

    renderPanel();

    expect(await screen.findByText(/^Connected to Google/)).toHaveTextContent(
      /^Connected to Google · loaded \d{1,2}[:.]\d{2}/,
    );
    expect(
      screen.getByRole("button", { name: "Calendar settings" }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /Connect Google/ })).toBeNull();
  });

  it("offers to connect when no calendar is connected, and no gear", async () => {
    status({ kind: "not-connected" });

    renderPanel();

    expect(await screen.findByText("Not connected to Google")).toBeVisible();
    expect(
      screen.getByText("Classes and meetings show up here once you connect."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Connect Google Calendar" }),
    ).toHaveAttribute("href", "/api/v1/calendar/connect");
    expect(
      screen.queryByRole("button", { name: "Calendar settings" }),
    ).toBeNull();
  });

  it("keeps the collapse button beside the title", async () => {
    status({ kind: "not-connected" });

    renderPanel();

    expect(
      await screen.findByRole("button", { name: "Collapse sidebar" }),
    ).toBeVisible();
  });

  it("does not claim a connection it could not check", async () => {
    status({ kind: "unavailable" });

    renderPanel();

    expect(await screen.findByText(/Couldn.t reach Google/)).toBeVisible();
    expect(screen.queryByText(/Connected to Google/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Connect Google/ })).toBeNull();
  });
});

describe("the calendar settings", () => {
  async function openSettings() {
    status({ kind: "connected" });
    renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Calendar settings" }),
    );
    return screen.findByRole("button", { name: "Disconnect" });
  }

  it("says what disconnecting does before it does it", async () => {
    await openSettings();

    expect(
      screen.getByText(/stops campus reading your calendar/),
    ).toBeVisible();
    expect(adapter.disconnectCalendar).not.toHaveBeenCalled();
  });

  it("disconnects, says so and shows the not-connected panel", async () => {
    const disconnect = await openSettings();
    adapter.disconnectCalendar.mockResolvedValue(
      "disconnected" satisfies CalendarDisconnect,
    );

    fireEvent.click(disconnect);

    await waitFor(() =>
      expect(toasts.add).toHaveBeenCalledWith({
        title: "Google Calendar disconnected.",
        type: "success",
      }),
    );
    expect(await screen.findByText("Not connected to Google")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Calendar settings" }),
    ).toBeNull();
  });

  it.each([
    ["failed", "We couldn't disconnect your calendar. Try again."],
    ["signed-out", "Your session ran out. Sign in and try again."],
  ] as const)(
    "keeps the calendar and says why after %s",
    async (outcome, title) => {
      const disconnect = await openSettings();
      adapter.disconnectCalendar.mockResolvedValue(outcome);

      fireEvent.click(disconnect);

      await waitFor(() =>
        expect(toasts.add).toHaveBeenCalledWith({ title, type: "warning" }),
      );
      expect(screen.getByText(/Connected to Google/)).toBeVisible();
    },
  );
});

describe("the connected panel", () => {
  const room = { code: "k3F9xQ2pLm", spaceName: "Pod A" };
  const today = {
    id: "e-1",
    kind: "campus",
    title: "Design review",
    start: "2026-09-30T10:00:00+01:00",
    end: "2026-09-30T11:00:00+01:00",
    allDay: false,
    status: "confirmed",
    response: null,
    location: null,
    googleUrl: null,
    room,
  } as const;
  const busy = {
    id: "b-1",
    kind: "busy",
    start: "2026-09-30T13:00:00+01:00",
    end: "2026-09-30T14:00:00+01:00",
    allDay: false,
    status: "confirmed",
    response: null,
  } as const;

  function connected(events: readonly unknown[]) {
    status({ kind: "connected", events, truncated: false } as CalendarRead);
  }

  it("lists today's rooms, with Join on the one that is open", async () => {
    connected([today, busy]);

    renderPanel();

    const list = await screen.findByRole("region", { name: "Today" });
    expect(within(list).getByText("Design review")).toBeVisible();
    expect(within(list).getByText(/Pod A/)).toBeVisible();
    expect(within(list).getByRole("link", { name: /Join/ })).toHaveAttribute(
      "href",
      "/join/k3F9xQ2pLm",
    );
    expect(within(list).queryByText("Busy")).toBeNull();
  });

  it("says there is nothing today when there is nothing", async () => {
    connected([]);

    renderPanel();

    expect(await screen.findByText("Nothing today.")).toBeVisible();
  });

  it("moves the visible range when a day of the month is pressed", async () => {
    connected([]);
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /October 7(?!\d)|7 October/,
      }),
    );

    // The range moves to that week, and today's list is read apart from it.
    await waitFor(() => {
      const asked = adapter.readCalendarEvents.mock.calls.map(([, window]) =>
        new Date(window.from).getTime(),
      );
      expect(asked).toContain(new Date(2026, 9, 5).getTime());
      expect(asked).toContain(new Date(2026, 8, 30).getTime());
    });
  });

  it("hides campus events from the list with the filter, and says so", async () => {
    connected([today]);
    renderPanel();
    await screen.findByText("Design review");

    fireEvent.click(screen.getByRole("checkbox", { name: "Campus events" }));

    expect(screen.queryByText("Design review")).toBeNull();
    expect(screen.getByText("Nothing today.")).toBeVisible();
  });

  it("has both filters on at the start", async () => {
    connected([]);

    renderPanel();

    expect(
      await screen.findByRole("checkbox", { name: "Campus events" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Busy from Google" }),
    ).toBeChecked();
  });

  it("shows no month, list or filters until there is a calendar to show", async () => {
    status({ kind: "not-connected" });

    renderPanel();

    await screen.findByText("Not connected to Google");
    expect(screen.queryByRole("region", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
