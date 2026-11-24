import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSessionContext } from "@/core/session";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type {
  CalendarDisconnect,
  CalendarStatusRead,
} from "../services/calendar-api.adapter";
import { CalendarPanel } from "./calendar-panel";

const adapter = vi.hoisted(() => ({
  disconnectCalendar: vi.fn(),
  readCalendarStatus: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("../services/calendar-api.adapter", () => adapter);
vi.mock("@/shared/ui/toast", () => ({ toast: toasts }));

function status(read: CalendarStatusRead) {
  adapter.readCalendarStatus.mockResolvedValue(read);
}

function renderPanel() {
  return render(
    withQueryClient(
      <RefreshSessionContext value={async () => ({ kind: "refreshed" })}>
        <CalendarPanel
          cohortId="c-1"
          collapseButton={<button type="button">Collapse sidebar</button>}
        />
      </RefreshSessionContext>,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CalendarPanel", () => {
  it("says it is asking Google until the answer comes", () => {
    adapter.readCalendarStatus.mockReturnValue(new Promise(() => undefined));

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
