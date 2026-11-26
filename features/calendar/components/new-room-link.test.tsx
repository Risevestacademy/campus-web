import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSessionContext } from "@/core/session";
import {
  ADA,
  applyFrame,
  callFrame,
  clearPresence,
  seedPresence,
  spaceChangedFrame,
} from "@/tests/fixtures/nearby-presence";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { resetCalendarView } from "../store/calendar-view-store";
import { CalendarPanel } from "./calendar-panel";

const adapter = vi.hoisted(() => ({
  disconnectCalendar: vi.fn(),
  readCalendarEvents: vi.fn(),
}));
const links = vi.hoisted(() => ({
  createRoomLink: vi.fn(),
  readLinkableSpaces: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("../services/calendar-api.adapter", () => adapter);
vi.mock("../services/room-link-api.adapter", () => links);
vi.mock("@/shared/ui/toast", () => ({ toast: toasts }));

type Role = "student" | "professor" | "mentor" | "guest";

function renderPanel(props: { administrator?: boolean; role?: Role } = {}) {
  return render(
    withQueryClient(
      <RefreshSessionContext value={async () => ({ kind: "refreshed" })}>
        <CalendarPanel
          administrator={props.administrator ?? false}
          cohortId="c-1"
          collapseButton={null}
          role={props.role}
        />
      </RefreshSessionContext>,
    ),
  );
}

function standInLibrary() {
  seedPresence("c-1");
  applyFrame("c-1", spaceChangedFrame(ADA, "library"));
  applyFrame("c-1", {
    type: "spaces",
    spaces: [{ spaceKey: "library", name: "Library" }],
  });
  applyFrame("c-1", callFrame("room"));
}

const button = () => screen.findByRole("button", { name: "New room link" });

beforeEach(() => {
  vi.clearAllMocks();
  resetCalendarView();
  adapter.readCalendarEvents.mockResolvedValue({
    kind: "connected",
    events: [],
    truncated: false,
  });
  links.readLinkableSpaces.mockResolvedValue({
    kind: "loaded",
    spaces: [
      { id: "s-1", name: "Pod A" },
      { id: "s-2", name: "Town Hall" },
    ],
  });
});

afterEach(() => {
  clearPresence("c-1");
});

describe("New room link", () => {
  it("is not offered to a student, a guest or a member with no role", async () => {
    for (const role of ["student", "guest", undefined] as const) {
      const { unmount } = renderPanel({ role });
      await screen.findByText(/^Connected to Google/);
      expect(
        screen.queryByRole("button", { name: "New room link" }),
      ).toBeNull();
      unmount();
    }
  });

  it("is not offered before there is a calendar", async () => {
    adapter.readCalendarEvents.mockResolvedValue({ kind: "not-connected" });

    renderPanel({ administrator: true });

    await screen.findByText("Not connected to Google");
    expect(screen.queryByRole("button", { name: "New room link" })).toBeNull();
  });

  it("lets an admin choose any space, and says it does not make the event", async () => {
    renderPanel({ administrator: true });

    fireEvent.click(await button());

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Campus doesn.t create the event/),
    ).toBeVisible();
    const select = await within(dialog).findByLabelText("Space");
    await waitFor(() => expect(select).toBeEnabled());
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a space", "Pod A", "Town Hall"]);
  });

  it("makes the link for the chosen space and says what to do with it", async () => {
    links.createRoomLink.mockResolvedValue({
      kind: "created",
      link: {
        code: "k3F9xQ2pLm",
        url: "https://campus.example/join/k3F9xQ2pLm",
        title: "Design review",
        spaceName: "Town Hall",
      },
    });
    renderPanel({ administrator: true });
    fireEvent.click(await button());
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText("Space");
    await waitFor(() => expect(select).toBeEnabled());

    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "  Design review  " },
    });
    fireEvent.change(select, { target: { value: "s-2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Make link" }));

    expect(
      await within(dialog).findByDisplayValue(
        "https://campus.example/join/k3F9xQ2pLm",
      ),
    ).toBeVisible();
    expect(links.createRoomLink).toHaveBeenCalledWith(
      expect.anything(),
      "c-1",
      "s-2",
      "Design review",
    );
    expect(
      within(dialog).getByText(
        /Paste it into the location or description of a Google Calendar event you organise\. Campus doesn.t create the event\. Once Google has it, it shows here, and people can enter from ten minutes before it starts\./,
      ),
    ).toBeVisible();
  });

  it("copies the link", async () => {
    links.createRoomLink.mockResolvedValue({
      kind: "created",
      link: {
        code: "k3F9xQ2pLm",
        url: "https://campus.example/join/k3F9xQ2pLm",
        title: "Design review",
        spaceName: "Pod A",
      },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPanel({ administrator: true });
    fireEvent.click(await button());
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText("Space");
    await waitFor(() => expect(select).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "Design review" },
    });
    fireEvent.change(select, { target: { value: "s-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Make link" }));

    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Copy link" }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://campus.example/join/k3F9xQ2pLm",
      ),
    );
    expect(toasts.add).toHaveBeenCalledWith({
      title: "Room link copied.",
      type: "success",
    });
  });

  it("will not make a link with no name or no space", async () => {
    renderPanel({ administrator: true });
    fireEvent.click(await button());
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: "Make link" }),
    ).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "   " },
    });
    expect(
      within(dialog).getByRole("button", { name: "Make link" }),
    ).toBeDisabled();
    expect(links.createRoomLink).not.toHaveBeenCalled();
  });

  it("says why when campus-api refuses", async () => {
    links.createRoomLink.mockResolvedValue({
      kind: "problem",
      problem: "forbidden",
    });
    renderPanel({ administrator: true });
    fireEvent.click(await button());
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByLabelText("Space");
    await waitFor(() => expect(select).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "Design review" },
    });
    fireEvent.change(select, { target: { value: "s-1" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Make link" }));

    expect(
      await within(dialog).findByText(
        "You can't make room links for this cohort.",
      ),
    ).toBeVisible();
  });

  it("gives a professor the space they stand in and no choice", async () => {
    standInLibrary();
    links.createRoomLink.mockResolvedValue({
      kind: "problem",
      problem: "unavailable",
    });
    renderPanel({ role: "professor" });

    fireEvent.click(await button());
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(
        "Your link will open Library. To make one for another space, walk into it first.",
      ),
    ).toBeVisible();
    expect(within(dialog).queryByLabelText("Space")).toBeNull();
    expect(links.readLinkableSpaces).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Event name"), {
      target: { value: "Stand-up" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Make link" }));
    await waitFor(() =>
      expect(links.createRoomLink).toHaveBeenCalledWith(
        expect.anything(),
        "c-1",
        "s-library",
        "Stand-up",
      ),
    );
  });

  it("gives a mentor the same", async () => {
    standInLibrary();

    renderPanel({ role: "mentor" });

    expect(await button()).toBeEnabled();
  });

  it("is not offered to a professor until World has named the space they stand in", async () => {
    seedPresence("c-1");

    renderPanel({ role: "professor" });

    expect(await button()).toBeDisabled();
    expect(
      screen.getByText("Walk into a space to make a link for it."),
    ).toBeVisible();
  });

  it("is not offered to a professor in the corridors", async () => {
    standInLibrary();
    applyFrame("c-1", spaceChangedFrame(ADA, "_default"));
    applyFrame("c-1", callFrame("room"));

    renderPanel({ role: "professor" });

    expect(await button()).toBeDisabled();
  });

  it("follows a professor into another space", async () => {
    standInLibrary();
    renderPanel({ role: "professor" });
    expect(await button()).toBeEnabled();

    applyFrame("c-1", spaceChangedFrame(ADA, "courtyard"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "New room link" }),
      ).toBeDisabled(),
    );
  });
});
