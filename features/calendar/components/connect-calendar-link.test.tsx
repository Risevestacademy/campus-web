import { fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";

import {
  type RefreshSession,
  RefreshSessionContext,
  type SessionRefreshResult,
} from "@/core/session";

import { ConnectCalendarLink } from "./connect-calendar-link";

const assign = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  assign.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, assign },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: realLocation,
  });
});

function renderLink(refresh: RefreshSession) {
  render(
    <RefreshSessionContext value={refresh}>
      <ConnectCalendarLink />
    </RefreshSessionContext>,
  );
  return screen.getByRole("link", { name: "Connect Google Calendar" });
}

describe("ConnectCalendarLink", () => {
  it("is a plain link to the connect route", () => {
    const link = renderLink(async () => ({ kind: "refreshed" }));

    expect(link).toHaveAttribute("href", "/api/v1/calendar/connect");
  });

  it("renews the session first and goes to Google once that has settled", async () => {
    let settle: (result: SessionRefreshResult) => void = () => undefined;
    const refresh = vi.fn(
      () => new Promise<SessionRefreshResult>((resolve) => (settle = resolve)),
    );
    const link = renderLink(refresh);

    fireEvent.click(link);

    expect(refresh).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    settle({ kind: "refreshed" });
    await vi.waitFor(() =>
      expect(assign).toHaveBeenCalledExactlyOnceWith(
        "/api/v1/calendar/connect",
      ),
    );
  });

  it.each([
    ["expired", { kind: "expired" }],
    ["failed", { kind: "failed" }],
  ] as const)(
    "goes anyway when the session %s, so campus-api answers it",
    async (_, result) => {
      const link = renderLink(async () => result);

      fireEvent.click(link);

      await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());
    },
  );

  it("goes even if renewing throws", async () => {
    const link = renderLink(async () => {
      throw new Error("network");
    });

    fireEvent.click(link);

    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());
  });

  it("starts one connection however often it is pressed", async () => {
    const refresh = vi.fn(async () => ({ kind: "refreshed" as const }));
    const link = renderLink(refresh);

    fireEvent.click(link);
    fireEvent.click(link);

    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["a new-tab click", { ctrlKey: true }],
    ["a command click", { metaKey: true }],
    ["a middle click", { button: 1 }],
  ])("leaves %s to the browser", (_, init) => {
    const refresh = vi.fn(async () => ({ kind: "refreshed" as const }));
    const link = renderLink(refresh);

    // Seen once it has bubbled past React: still free to go where the browser
    // takes it. It is then cancelled so jsdom does not try to navigate.
    let defaultPrevented: boolean | undefined;
    const record = (event: Event) => {
      defaultPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", record);
    onTestFinished(() => document.removeEventListener("click", record));

    fireEvent.click(link, init);

    expect(defaultPrevented).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
