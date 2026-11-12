import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpaceLock } from "../hooks/use-space-lock";
import { setSidebarOpen } from "../store/sidebar-store";
import { CampusViewProvider } from "./campus-view-provider";
import { MeetingHeader } from "./meeting-header";

function lockOf(overrides: Partial<SpaceLock> = {}): SpaceLock {
  return {
    canChange: true,
    locked: false,
    spaceName: "Room 1",
    toggle: vi.fn(),
    ...overrides,
  };
}

function renderHeader(lock: SpaceLock | null) {
  render(
    <CampusViewProvider>
      <MeetingHeader lock={lock} meeting={null} />
    </CampusViewProvider>,
  );
}

afterEach(() => act(() => setSidebarOpen(true)));

describe("MeetingHeader", () => {
  it("offers to lock the room the member is alone in, under its name", () => {
    const lock = lockOf();
    renderHeader(lock);

    expect(screen.getByRole("heading", { name: "Room 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lock Room 1" }));

    expect(lock.toggle).toHaveBeenCalledOnce();
  });

  it("shows a locked room as pressed, and offers to unlock it", () => {
    renderHeader(lockOf({ locked: true }));

    expect(
      screen.getByRole("button", { name: "Unlock Room 1" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the lock still until world is back", () => {
    renderHeader(lockOf({ canChange: false }));

    expect(screen.getByRole("button", { name: "Lock Room 1" })).toBeDisabled();
  });

  it("shows no lock outside a lockable room", () => {
    renderHeader(null);

    expect(
      screen.queryByRole("button", { name: /lock/i }),
    ).not.toBeInTheDocument();
  });

  it("offers to open the sidebar only while it is closed", () => {
    act(() => setSidebarOpen(false));
    renderHeader(null);
    const open = screen.getByRole("button", { name: "Open sidebar" });

    fireEvent.click(open);

    expect(
      screen.queryByRole("button", { name: "Open sidebar" }),
    ).not.toBeInTheDocument();
    act(() => setSidebarOpen(false));
    expect(
      screen.getByRole("button", { name: "Open sidebar" }),
    ).toBeInTheDocument();
  });
});
