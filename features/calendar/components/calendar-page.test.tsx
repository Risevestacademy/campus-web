import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSessionContext } from "@/core/session";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import type { CalendarRead } from "../services/calendar-api.adapter";
import { resetCalendarView } from "../store/calendar-view-store";
import { CalendarPage } from "./calendar-page";

process.env.TZ = "Europe/London";

const adapter = vi.hoisted(() => ({ readCalendarEvents: vi.fn() }));

vi.mock("../services/calendar-api.adapter", () => adapter);

// Wednesday 30 September 2026, 09:55 in London: five minutes before the
// 10:00 event, so it is open.
const NOW = new Date(2026, 8, 30, 9, 55);

const campusEvent = (extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: "e-1",
    kind: "campus",
    title: "Design review",
    start: "2026-09-30T10:00:00+01:00",
    end: "2026-09-30T11:00:00+01:00",
    allDay: false,
    status: "confirmed",
    response: "accepted",
    location: null,
    googleUrl: "https://www.google.com/calendar/event?eid=abc",
    room: { code: "k3F9xQ2pLm", spaceName: "Pod A" },
    ...extra,
  }) as CalendarEvent;

const busyEvent: CalendarEvent = {
  id: "b-1",
  kind: "busy",
  start: "2026-09-30T13:00:00+01:00",
  end: "2026-09-30T14:00:00+01:00",
  allDay: false,
  status: "confirmed",
  response: null,
};

function connected(events: CalendarEvent[], truncated = false): CalendarRead {
  return { kind: "connected", events, truncated };
}

let client: QueryClient;

function renderPage(read: CalendarRead | Promise<never>) {
  adapter.readCalendarEvents.mockImplementation(() =>
    read instanceof Promise ? read : Promise.resolve(read),
  );
  return render(
    <QueryClientProvider client={client}>
      <RefreshSessionContext value={async () => ({ kind: "refreshed" })}>
        <CalendarPage cohortId="c-1" />
      </RefreshSessionContext>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  client = new QueryClient();
  resetCalendarView();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarPage", () => {
  it("waits for Google before showing anything it might have to take back", () => {
    renderPage(new Promise(() => undefined));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking Google Calendar…",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers to connect, and promises only what campus does", async () => {
    renderPage({ kind: "not-connected" });

    expect(
      await screen.findByRole("heading", { name: "Connect Google Calendar" }),
    ).toBeVisible();
    expect(screen.getByText(/never creates or changes an event/)).toBeVisible();
    expect(screen.queryByText(/remind/i)).toBeNull();
    expect(screen.queryByText(/both ways/i)).toBeNull();
  });

  it("asks for this week, and shows its days from Monday", async () => {
    renderPage(connected([]));

    expect(
      await screen.findByRole("heading", {
        name: /28.*4.*2026|Sep.*28.*Oct.*4/,
      }),
    ).toBeVisible();
    const asked = adapter.readCalendarEvents.mock.calls[0];
    expect(new Date(asked?.[1].from)).toEqual(new Date(2026, 8, 28));
    expect(new Date(asked?.[1].to)).toEqual(new Date(2026, 9, 5));
    expect(asked?.[2]).toBe("c-1");
  });

  it("shows an event of this cohort's room with its time, and Busy for the rest", async () => {
    renderPage(connected([campusEvent(), busyEvent]));

    expect(
      await screen.findByRole("button", {
        name: /^Design review, .*10:00 – 11:00$/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Busy, .*13:00 – 14:00$/ }),
    ).toBeVisible();
  });

  it("says there is nothing when the week is empty", async () => {
    renderPage(connected([]));

    expect(await screen.findByText("No events this week.")).toBeVisible();
  });

  it("says when campus-api cut the list short", async () => {
    renderPage(connected([campusEvent()], true));

    expect(
      await screen.findByText(
        "Showing the first 1,000 events. Choose a shorter range.",
      ),
    ).toBeVisible();
  });

  it("marks an event LIVE with a Join link from ten minutes before it starts", async () => {
    renderPage(connected([campusEvent()]));

    expect(await screen.findByRole("link", { name: /^Join/ })).toHaveAttribute(
      "href",
      "/join/k3F9xQ2pLm",
    );
    expect(screen.getByText(/LIVE/)).toBeVisible();
  });

  it("has no Join for an event that is not open yet", async () => {
    renderPage(
      connected([
        campusEvent({
          start: "2026-09-30T15:00:00+01:00",
          end: "2026-09-30T16:00:00+01:00",
        }),
      ]),
    );

    await screen.findByRole("button", { name: /Design review/ });
    expect(screen.queryByRole("link", { name: /^Join/ })).toBeNull();
    expect(screen.queryByText(/LIVE/)).toBeNull();
  });

  it("strikes a declined event and dashes a tentative one", async () => {
    renderPage(
      connected([
        campusEvent({ response: "declined" }),
        campusEvent({ id: "e-2", status: "tentative", title: "Maybe" }),
      ]),
    );

    const declined = await screen.findByRole("button", {
      name: /^Design review/,
    });
    expect(within(declined).getByText("Design review")).toHaveClass(
      "line-through",
    );
    expect(
      screen.getByRole("button", { name: /^Maybe/ }).parentElement,
    ).toHaveClass("border-dashed");
  });

  it("opens an event's details, with its room and a Google link that is safe to follow", async () => {
    renderPage(connected([campusEvent()]));

    fireEvent.click(
      await screen.findByRole("button", { name: /^Design review/ }),
    );

    expect(await screen.findByText("Room: Pod A")).toBeVisible();
    expect(screen.getByText("You accepted")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open in Google Calendar/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("button", { name: "Copy room link" }),
    ).toBeVisible();
  });

  it("shows a Busy event as only a time", async () => {
    renderPage(connected([busyEvent]));

    fireEvent.click(await screen.findByRole("button", { name: /^Busy/ }));

    expect(await screen.findByText("Busy · From Google")).toBeVisible();
    expect(screen.queryByText(/Room:/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("moves to the next week and asks for it, keeping this one on screen meanwhile", async () => {
    renderPage(connected([campusEvent()]));
    await screen.findByRole("button", { name: /^Design review/ });
    adapter.readCalendarEvents.mockReturnValue(new Promise(() => undefined));

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));

    await waitFor(() =>
      expect(
        new Date(adapter.readCalendarEvents.mock.calls.at(-1)?.[1].from),
      ).toEqual(new Date(2026, 9, 5)),
    );
    expect(
      screen.getByRole("heading", { name: /Oct.*5.*Oct.*11|5.*Oct.*11.*Oct/ }),
    ).toBeVisible();
  });

  it("switches to Day and to Month from one set of controls", async () => {
    renderPage(connected([campusEvent()]));
    await screen.findByRole("button", { name: /^Design review/ });

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(
      await screen.findByRole("heading", {
        name: /Sep.*30.*2026|30.*Sep.*2026/,
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(
      await screen.findByRole("heading", {
        name: /September 2026|2026.*September/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Design review/ }),
    ).toBeVisible();
  });

  it("opens a day from '+n more' in the month", async () => {
    const many = [1, 2, 3, 4].map((n) =>
      campusEvent({ id: `e-${n}`, title: `Event ${n}` }),
    );
    renderPage(connected(many));
    await screen.findByRole("button", { name: /^Event 1/ });
    fireEvent.click(screen.getByRole("button", { name: "Month" }));

    fireEvent.click(
      await screen.findByRole("button", { name: /1 more event/ }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /Sep.*30.*2026|30.*Sep.*2026/,
      }),
    ).toBeVisible();
  });

  it("dims the events and offers Retry when Google stops answering", async () => {
    renderPage(connected([campusEvent()]));
    await screen.findByRole("button", { name: /^Design review/ });
    adapter.readCalendarEvents.mockResolvedValue({ kind: "unavailable" });

    await act(() => client.invalidateQueries());

    expect(
      await screen.findByText("Google Calendar didn’t answer."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Design review/ }),
    ).toBeVisible();
  });

  it("says Google did not answer, with no events to dim, and tries again on Retry", async () => {
    renderPage({ kind: "unavailable" });

    expect(
      await screen.findByText("Google Calendar didn’t answer."),
    ).toBeVisible();
    adapter.readCalendarEvents.mockResolvedValue(connected([]));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No events this week.")).toBeVisible();
  });

  it("asks the member to sign in again when the session ended", async () => {
    renderPage({ kind: "signed-out" });

    expect(await screen.findByText("Your session ran out")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("says Google ended the connection when it was connected a moment ago", async () => {
    renderPage(connected([]));
    await screen.findByText("No events this week.");
    adapter.readCalendarEvents.mockResolvedValue({ kind: "not-connected" });

    await act(() => client.invalidateQueries());

    expect(
      await screen.findByText(
        "Google ended the connection. Connect again to see your events.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Connect Google Calendar" }),
    ).toBeVisible();
  });
});
