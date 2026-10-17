import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AdmissionState,
  createAdmissionStore,
} from "../services/presence-session/admission-store";
import {
  AdmissionProvider,
  PresenceTabProvider,
} from "../services/presence-session/presence-session-provider";
import { createTestPresenceTab } from "../testing/presence-tab-test-utils";
import { CampusJoinButton } from "./campus-join-button";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

function joinButton() {
  const store = createAdmissionStore();
  const tab = createTestPresenceTab();
  render(
    <AdmissionProvider store={store}>
      <PresenceTabProvider tab={tab}>
        <CampusJoinButton destination="/campus/c-1/meeting?tab=people" />
      </PresenceTabProvider>
    </AdmissionProvider>,
  );
  return { store, tab };
}

describe("CampusJoinButton", () => {
  beforeEach(() => navigation.push.mockReset());

  it("claims the cohort, grants the exact destination before navigating and prevents another activation", async () => {
    const { store, tab } = joinButton();
    const statesAtNavigation: AdmissionState[] = [];
    navigation.push.mockImplementation(() => {
      statesAtNavigation.push(store.getState());
    });

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    const pendingButton = screen.getByRole("button", { name: "Joining…" });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);

    await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
    expect(tab.claim).toHaveBeenCalledOnce();
    expect(statesAtNavigation[0]?.pendingDestination).toBe(
      "/campus/c-1/meeting?tab=people",
    );
    expect(navigation.push).toHaveBeenCalledWith(
      "/campus/c-1/meeting?tab=people",
    );
  });

  it("neither admits nor navigates when another tab joined first", async () => {
    const { store, tab } = joinButton();
    tab.claim.mockResolvedValue(false);

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await vi.waitFor(() => expect(tab.claim).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(store.getState().pendingDestination).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
