import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSessionContext } from "@/core/session";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type { CalendarStatusRead } from "../services/calendar-api.adapter";
import { CalendarPage } from "./calendar-page";

const adapter = vi.hoisted(() => ({ readCalendarStatus: vi.fn() }));

vi.mock("../services/calendar-api.adapter", () => adapter);

function renderPage(read: CalendarStatusRead | Promise<never>) {
  adapter.readCalendarStatus.mockImplementation(() =>
    read instanceof Promise ? read : Promise.resolve(read),
  );
  return render(
    withQueryClient(
      <RefreshSessionContext value={async () => ({ kind: "refreshed" })}>
        <CalendarPage />
      </RefreshSessionContext>,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(screen.getByText(/Other events show only as/)).toBeVisible();
    expect(screen.queryByText(/remind/i)).toBeNull();
    expect(screen.queryByText(/both ways/i)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Connect Google Calendar" }),
    ).toHaveAttribute("href", "/api/v1/calendar/connect");
  });

  it("says a connected calendar is connected", async () => {
    renderPage({ kind: "connected" });

    expect(
      await screen.findByRole("heading", {
        name: "Your calendar is connected",
      }),
    ).toBeVisible();
  });

  it("says Google did not answer and tries again on Retry", async () => {
    renderPage({ kind: "unavailable" });

    expect(
      await screen.findByText("Google Calendar didn’t answer."),
    ).toBeVisible();
    adapter.readCalendarStatus.mockResolvedValue({ kind: "connected" });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", {
        name: "Your calendar is connected",
      }),
    ).toBeVisible();
  });

  it("asks the member to sign in again when the session ended", async () => {
    renderPage({ kind: "signed-out" });

    expect(await screen.findByText("Your session ran out")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
