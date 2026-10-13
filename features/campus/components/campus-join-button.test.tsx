import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampusAdmissionProvider } from "../services/admission/campus-admission-provider";
import {
  type CampusAdmissionState,
  createCampusAdmissionStore,
} from "../services/admission/campus-admission-store";
import { CampusJoinButton } from "./campus-join-button";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

describe("CampusJoinButton", () => {
  beforeEach(() => navigation.push.mockClear());

  it("grants the exact destination before navigating and prevents another activation", () => {
    const store = createCampusAdmissionStore();
    const statesAtNavigation: CampusAdmissionState[] = [];
    navigation.push.mockImplementation(() => {
      statesAtNavigation.push(store.getState());
    });
    render(
      <CampusAdmissionProvider store={store}>
        <CampusJoinButton destination="/campus/c-1/meeting?tab=people" />
      </CampusAdmissionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(statesAtNavigation[0]?.pendingActiveCampusDestination).toBe(
      "/campus/c-1/meeting?tab=people",
    );
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/campus/c-1/meeting?tab=people",
    );
    const pendingButton = screen.getByRole("button", { name: "Joining…" });
    expect(pendingButton).toBeDisabled();

    fireEvent.click(pendingButton);
    expect(navigation.push).toHaveBeenCalledOnce();
  });
});
