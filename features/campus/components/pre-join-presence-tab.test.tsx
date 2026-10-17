import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdmissionStore } from "../services/presence-session/admission-store";
import {
  AdmissionProvider,
  PresenceTabProvider,
} from "../services/presence-session/presence-session-provider";
import type { PresenceTabStatus } from "../services/presence-session/presence-tab";
import { createTestPresenceTab } from "../testing/presence-tab-test-utils";
import { PreJoinPresenceTab } from "./pre-join-presence-tab";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

const DESTINATION = "/campus/c-1/meeting?tab=people";

function preJoin(status: PresenceTabStatus) {
  const admission = createAdmissionStore();
  const tab = createTestPresenceTab(status);

  const { container } = render(
    <AdmissionProvider store={admission}>
      <PresenceTabProvider tab={tab}>
        <PreJoinPresenceTab destination={DESTINATION}>
          <p>Device setup</p>
        </PreJoinPresenceTab>
      </PresenceTabProvider>
    </AdmissionProvider>,
  );

  return { admission, container, tab };
}

describe("PreJoinPresenceTab", () => {
  beforeEach(() => navigation.push.mockReset());

  it("renders nothing until the other tabs are checked", () => {
    const { container } = preJoin("checking");

    expect(container).toBeEmptyDOMElement();
  });

  it("shows device setup when no other tab holds the cohort", () => {
    preJoin("vacant");

    expect(screen.getByText("Device setup")).toBeVisible();
  });

  it("offers the choice instead of device setup when another tab holds the cohort", () => {
    preJoin("elsewhere");

    expect(
      screen.getByRole("heading", {
        name: "You're in this cohort in another tab",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Device setup")).not.toBeInTheDocument();
  });

  it("swaps device setup for the choice when another tab joins", () => {
    const { tab } = preJoin("vacant");

    act(() => tab.setStatus("elsewhere"));

    expect(screen.queryByText("Device setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use here" })).toBeVisible();
  });

  it("returns to device setup when the other tab leaves", () => {
    const { tab } = preJoin("elsewhere");

    act(() => tab.setStatus("vacant"));

    expect(screen.getByText("Device setup")).toBeVisible();
  });

  it("takes the session over, then admits and enters the destination", async () => {
    const { admission, tab } = preJoin("elsewhere");
    const pendingAtNavigation: (string | null)[] = [];
    navigation.push.mockImplementation(() => {
      pendingAtNavigation.push(admission.getState().pendingDestination);
    });

    fireEvent.click(screen.getByRole("button", { name: "Use here" }));

    await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
    expect(tab.takeOver).toHaveBeenCalledOnce();
    expect(navigation.push).toHaveBeenCalledWith(DESTINATION);
    expect(pendingAtNavigation).toEqual([DESTINATION]);
  });

  it("keeps showing the move instead of device setup while it navigates", async () => {
    preJoin("elsewhere");

    fireEvent.click(screen.getByRole("button", { name: "Use here" }));

    await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
    expect(screen.queryByText("Device setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
  });

  it("never admits before the session has moved", () => {
    const { admission, tab } = preJoin("elsewhere");
    tab.takeOver.mockReturnValue(new Promise(() => {}));

    fireEvent.click(screen.getByRole("button", { name: "Use here" }));

    expect(admission.getState().pendingDestination).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
