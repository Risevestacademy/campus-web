import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Avatar } from "@/core/realtime";
import { activeCampusLayout } from "@/tests/fixtures/active-campus-layout";
import {
  applyFrame,
  clearPresence,
  GRACE,
  joinedFrame,
  nearbyFrame,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub"));
vi.mock("server-only", () => ({}));

const COHORT_ID = "c-1";
const TONI: Avatar = {
  userId: "55555555-5555-4555-8555-555555555555",
  x: 2,
  y: 1,
  facing: "left",
  displayName: "Toni Morrison",
  spriteKey: null,
};

async function renderActiveCampusLayout() {
  return render(await activeCampusLayout());
}

function nearbyHeading() {
  return screen.queryByRole("heading", { name: "Nearby" });
}

function tileFor(name: string) {
  return screen.queryByRole("button", {
    name: `Show expanded meeting view for ${name}`,
  });
}

function gridSwitch() {
  return screen.getByRole("switch", { name: "Use grid view" });
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
  clearPresence(COHORT_ID);
});

describe("proximity view eval (required threshold: 5/5)", () => {
  it("shows no meeting while nobody is near", async () => {
    seedPresence(COHORT_ID);
    await renderActiveCampusLayout();

    expect(nearbyHeading()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Meeting participant tiles" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Use grid view" }),
    ).not.toBeInTheDocument();
  });

  it("shows you and whoever world names in the same render as the nearby frame", async () => {
    seedPresence(COHORT_ID);
    await renderActiveCampusLayout();

    act(() => applyFrame(COHORT_ID, nearbyFrame(GRACE)));

    expect(nearbyHeading()).toBeInTheDocument();
    expect(tileFor("Ada Lovelace")).toBeInTheDocument();
    expect(tileFor("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("never shows anyone on the map who is not near", async () => {
    seedPresence(COHORT_ID, GRACE);
    await renderActiveCampusLayout();

    expect(tileFor("Grace Hopper")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Grace Hopper" }),
    ).toBeInTheDocument();
    for (const name of ["Lin Wei", "Maya Angelou"]) {
      expect(screen.queryByRole("img", { name })).not.toBeInTheDocument();
      expect(tileFor(name)).not.toBeInTheDocument();
    }
  });

  it("drops an open grid to the map when everyone walks away, and opens the next encounter on the map", async () => {
    seedPresence(COHORT_ID, GRACE);
    await renderActiveCampusLayout();
    fireEvent.click(gridSwitch(), { detail: 0 });
    expect(screen.getByTestId("meeting-view-backdrop")).toBeInTheDocument();

    act(() => applyFrame(COHORT_ID, nearbyFrame()));

    expect(gridSwitch()).toHaveAttribute("aria-checked", "false");
    await waitFor(() => {
      expect(
        screen.queryByTestId("meeting-view-backdrop"),
      ).not.toBeInTheDocument();
      expect(nearbyHeading()).not.toBeInTheDocument();
    });

    act(() => applyFrame(COHORT_ID, nearbyFrame(GRACE)));

    expect(gridSwitch()).toHaveAttribute("aria-checked", "false");
    expect(tileFor("Grace Hopper")).toBeInTheDocument();
    expect(
      screen.queryByTestId("meeting-view-backdrop"),
    ).not.toBeInTheDocument();
  });

  it("waits for world to introduce somebody before showing them", async () => {
    seedPresence(COHORT_ID);
    await renderActiveCampusLayout();

    act(() => applyFrame(COHORT_ID, nearbyFrame(TONI)));

    expect(nearbyHeading()).not.toBeInTheDocument();

    act(() => applyFrame(COHORT_ID, joinedFrame(TONI)));

    expect(nearbyHeading()).toBeInTheDocument();
    expect(tileFor("Toni Morrison")).toBeInTheDocument();
  });
});
